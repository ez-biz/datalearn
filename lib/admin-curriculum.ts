import { prisma } from "@/lib/prisma"
import { slugify } from "@/lib/admin-validation"

export type CurriculumMutationResult<T = void> =
    | (T extends void ? { ok: true } : { ok: true; data: T })
    | { ok: false; status: number; error: string }

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
}

/**
 * Which unique constraint did Prisma actually trip? P2002's `meta.target`
 * carries the offending column names, and without checking it a position
 * collision gets reported as a slug conflict.
 *
 * `lib/prisma.ts` uses the `@prisma/adapter-pg` driver adapter, which does
 * NOT populate `meta.target` — that field only shows up under the default
 * query-engine binary. Under the driver adapter the columns instead live at
 * `meta.driverAdapterError.cause.constraint.fields` (verified empirically
 * against this project's Postgres instance), quoted per-identifier, e.g.
 * `["\"trackId\"", "slug"]`. Check both shapes so this keeps working
 * whichever engine mode is active.
 */
function isUniqueViolationOn(error: unknown, field: string): boolean {
    if (!isPrismaCode(error, "P2002")) return false
    const meta = (error as { meta?: Record<string, unknown> }).meta
    const target = meta?.target
    if (Array.isArray(target) && target.map(String).includes(field)) return true
    if (typeof target === "string" && target.includes(field)) return true

    const driverFields = (
        meta as
            | { driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } } }
            | undefined
    )?.driverAdapterError?.cause?.constraint?.fields
    if (Array.isArray(driverFields)) {
        return driverFields.some((f) => String(f).replace(/"/g, "") === field)
    }
    return false
}

/** Concurrent curriculum edits invalidated a list we read before the write. */
const STALE_WRITE = {
    ok: false as const,
    status: 409,
    error: "The module list changed during the write — reload and retry.",
}

function setsEqual(left: Set<string>, right: Set<string>): boolean {
    if (left.size !== right.size) return false
    for (const value of left) {
        if (!right.has(value)) return false
    }
    return true
}

async function findTrackId(trackSlug: string): Promise<string | null> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: { id: true },
    })
    return track?.id ?? null
}

/**
 * Renumber `keys` to positions 0..n-1 via `update`.
 *
 * Two passes: park everything at a negative position first, then assign the
 * real ones. A single forward pass would transiently collide with the unique
 * (parent, position) constraint. Callers must run this inside a transaction.
 *
 * The `update` callback exists because the three position-bearing models have
 * different composite-key shapes — Module keys on `id`, ModuleLesson on
 * `moduleId_articleId`, LessonCheckpoint on `articleId_problemId`.
 */
async function renumber(
    keys: string[],
    update: (key: string, position: number) => Promise<unknown>,
): Promise<void> {
    for (let i = 0; i < keys.length; i++) await update(keys[i], -i - 1)
    for (let i = 0; i < keys.length; i++) await update(keys[i], i)
}

export async function createModule(
    trackSlug: string,
    input: {
        name: string
        slug?: string
        description: string
        position?: number
    },
): Promise<CurriculumMutationResult<{ id: string; slug: string }>> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const slug = input.slug ?? slugify(input.name)

    try {
        const created = await prisma.$transaction(async (tx) => {
            const current = await tx.module.findMany({
                where: { trackId },
                orderBy: { position: "asc" },
                select: { id: true, position: true },
            })
            const position = Math.min(
                input.position ?? current.length,
                current.length,
            )

            // Shift from the tail inwards so the unique (trackId, position)
            // constraint is never violated mid-loop.
            const toShift = current
                .filter((m) => m.position >= position)
                .sort((a, b) => b.position - a.position)
            for (const m of toShift) {
                await tx.module.update({
                    where: { id: m.id },
                    data: { position: m.position + 1 },
                })
            }

            return tx.module.create({
                data: {
                    trackId,
                    slug,
                    name: input.name,
                    description: input.description,
                    position,
                },
                select: { id: true, slug: true },
            })
        })
        return { ok: true, data: created }
    } catch (error) {
        if (isUniqueViolationOn(error, "slug")) {
            return {
                ok: false,
                status: 409,
                error: "A module with that slug already exists in this track.",
            }
        }
        if (isUniqueViolationOn(error, "position")) {
            return STALE_WRITE
        }
        console.error("Create module failed:", error)
        return { ok: false, status: 500, error: "Failed to create module." }
    }
}

export async function updateModule(
    trackSlug: string,
    moduleSlug: string,
    updates: { name?: string; slug?: string; description?: string },
): Promise<CurriculumMutationResult<{ id: string; slug: string }>> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const existing = await prisma.module.findUnique({
        where: { trackId_slug: { trackId, slug: moduleSlug } },
        select: { id: true },
    })
    if (!existing) return { ok: false, status: 404, error: "Module not found." }

    try {
        const updated = await prisma.module.update({
            where: { id: existing.id },
            data: updates,
            select: { id: true, slug: true },
        })
        return { ok: true, data: updated }
    } catch (error) {
        if (isUniqueViolationOn(error, "slug")) {
            return {
                ok: false,
                status: 409,
                error: "A module with that slug already exists in this track.",
            }
        }
        console.error("Update module failed:", error)
        return { ok: false, status: 500, error: "Failed to update module." }
    }
}

export async function deleteModule(
    trackSlug: string,
    moduleSlug: string,
): Promise<CurriculumMutationResult> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const modules = await prisma.module.findMany({
        where: { trackId },
        orderBy: { position: "asc" },
        select: { id: true, slug: true },
    })
    const target = modules.find((m) => m.slug === moduleSlug)
    if (!target) return { ok: false, status: 404, error: "Module not found." }

    const remaining = modules.filter((m) => m.id !== target.id).map((m) => m.id)

    try {
        await prisma.$transaction(async (tx) => {
            await tx.module.delete({ where: { id: target.id } })
            await renumber(remaining, (id, position) =>
                tx.module.update({ where: { id }, data: { position } }),
            )
        })
    } catch (error) {
        if (isPrismaCode(error, "P2025") || isPrismaCode(error, "P2002")) {
            return STALE_WRITE
        }
        console.error("Delete module failed:", error)
        return { ok: false, status: 500, error: "Failed to delete module." }
    }

    return { ok: true }
}

export async function reorderModules(
    trackSlug: string,
    moduleSlugs: string[],
): Promise<CurriculumMutationResult> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }

    const modules = await prisma.module.findMany({
        where: { trackId },
        select: { id: true, slug: true },
    })
    const currentSlugs = new Set(modules.map((m) => m.slug))
    const requested = new Set(moduleSlugs)
    if (
        moduleSlugs.length !== requested.size ||
        !setsEqual(currentSlugs, requested)
    ) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current module exactly once.",
        }
    }

    const idBySlug = new Map(modules.map((m) => [m.slug, m.id]))
    const orderedIds = moduleSlugs.map((s) => idBySlug.get(s)!)

    try {
        await prisma.$transaction(async (tx) =>
            renumber(orderedIds, (id, position) =>
                tx.module.update({ where: { id }, data: { position } }),
            ),
        )
    } catch (error) {
        if (isPrismaCode(error, "P2025") || isPrismaCode(error, "P2002")) {
            return STALE_WRITE
        }
        console.error("Reorder modules failed:", error)
        return { ok: false, status: 500, error: "Failed to reorder modules." }
    }

    return { ok: true }
}
