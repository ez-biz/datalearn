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
 *
 * Exported for direct testing: the two error shapes below were established
 * empirically and a regression here would silently mislabel every conflict.
 */
export function isUniqueViolationOn(error: unknown, field: string): boolean {
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
    error: "The curriculum changed during the write — reload and retry.",
}

/**
 * Map a write-time Prisma failure to a caller-facing result.
 *
 * P2025 (record vanished) and P2002 (position collided) both mean a
 * concurrent curriculum edit invalidated a list we read before the write —
 * the caller should reload and retry, not treat it as a server fault.
 * Anything else is a genuine error and stays loud.
 *
 * Exported for direct testing: the race that produces these codes cannot be
 * driven deterministically from a test, so the mapping is verified in
 * isolation instead.
 */
export function mapWriteFailure(
    error: unknown,
    verb: string,
): { ok: false; status: number; error: string } {
    if (isPrismaCode(error, "P2025") || isPrismaCode(error, "P2002")) {
        return STALE_WRITE
    }
    console.error(`${verb} failed:`, error)
    return { ok: false, status: 500, error: `Failed to ${verb}.` }
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
        return mapWriteFailure(error, "delete module")
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
        return mapWriteFailure(error, "reorder modules")
    }

    return { ok: true }
}

async function findModuleId(
    trackSlug: string,
    moduleSlug: string,
): Promise<{ ok: true; id: string } | { ok: false; status: number; error: string }> {
    const trackId = await findTrackId(trackSlug)
    if (!trackId) return { ok: false, status: 404, error: "Track not found." }
    const mod = await prisma.module.findUnique({
        where: { trackId_slug: { trackId, slug: moduleSlug } },
        select: { id: true },
    })
    if (!mod) return { ok: false, status: 404, error: "Module not found." }
    return { ok: true, id: mod.id }
}

async function findArticleId(articleSlug: string): Promise<string | null> {
    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    return article?.id ?? null
}

export async function addLessonToModule(
    trackSlug: string,
    moduleSlug: string,
    input: { articleSlug: string; position?: number },
): Promise<CurriculumMutationResult<{ articleId: string; position: number }>> {
    const found = await findModuleId(trackSlug, moduleSlug)
    if (!found.ok) return found
    const moduleId = found.id

    const articleId = await findArticleId(input.articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const existing = await prisma.moduleLesson.findUnique({
        where: { moduleId_articleId: { moduleId, articleId } },
        select: { articleId: true },
    })
    if (existing) {
        return {
            ok: false,
            status: 409,
            error: "That lesson is already in this module.",
        }
    }

    try {
        const created = await prisma.$transaction(async (tx) => {
            const current = await tx.moduleLesson.findMany({
                where: { moduleId },
                orderBy: { position: "asc" },
                select: { articleId: true, position: true },
            })
            const position = Math.min(
                input.position ?? current.length,
                current.length,
            )
            const toShift = current
                .filter((l) => l.position >= position)
                .sort((a, b) => b.position - a.position)
            for (const l of toShift) {
                await tx.moduleLesson.update({
                    where: {
                        moduleId_articleId: { moduleId, articleId: l.articleId },
                    },
                    data: { position: l.position + 1 },
                })
            }
            return tx.moduleLesson.create({
                data: { moduleId, articleId, position },
                select: { articleId: true, position: true },
            })
        })

        return { ok: true, data: created }
    } catch (error) {
        return mapWriteFailure(error, "add lesson to module")
    }
}

export async function removeLessonFromModule(
    trackSlug: string,
    moduleSlug: string,
    articleSlug: string,
): Promise<CurriculumMutationResult> {
    const found = await findModuleId(trackSlug, moduleSlug)
    if (!found.ok) return found
    const moduleId = found.id

    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const lessons = await prisma.moduleLesson.findMany({
        where: { moduleId },
        orderBy: { position: "asc" },
        select: { articleId: true },
    })
    if (!lessons.some((l) => l.articleId === articleId)) {
        return { ok: false, status: 404, error: "Lesson not in this module." }
    }
    const remaining = lessons
        .map((l) => l.articleId)
        .filter((id) => id !== articleId)

    try {
        await prisma.$transaction(async (tx) => {
            await tx.moduleLesson.delete({
                where: { moduleId_articleId: { moduleId, articleId } },
            })
            await renumber(remaining, (id, position) =>
                tx.moduleLesson.update({
                    where: { moduleId_articleId: { moduleId, articleId: id } },
                    data: { position },
                }),
            )
        })
    } catch (error) {
        return mapWriteFailure(error, "remove lesson from module")
    }

    return { ok: true }
}

export async function reorderModuleLessons(
    trackSlug: string,
    moduleSlug: string,
    articleSlugs: string[],
): Promise<CurriculumMutationResult> {
    const found = await findModuleId(trackSlug, moduleSlug)
    if (!found.ok) return found
    const moduleId = found.id

    const lessons = await prisma.moduleLesson.findMany({
        where: { moduleId },
        select: { articleId: true, article: { select: { slug: true } } },
    })
    const currentSlugs = new Set(lessons.map((l) => l.article.slug))
    const requested = new Set(articleSlugs)
    if (
        articleSlugs.length !== requested.size ||
        !setsEqual(currentSlugs, requested)
    ) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current lesson exactly once.",
        }
    }

    const idBySlug = new Map(lessons.map((l) => [l.article.slug, l.articleId]))
    const ordered = articleSlugs.map((s) => idBySlug.get(s)!)

    try {
        await prisma.$transaction(async (tx) =>
            renumber(ordered, (id, position) =>
                tx.moduleLesson.update({
                    where: { moduleId_articleId: { moduleId, articleId: id } },
                    data: { position },
                }),
            ),
        )
    } catch (error) {
        return mapWriteFailure(error, "reorder module lessons")
    }

    return { ok: true }
}

export async function addCheckpoint(
    articleSlug: string,
    input: { problemSlug: string; position?: number },
): Promise<CurriculumMutationResult<{ problemId: string; position: number }>> {
    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const problem = await prisma.sQLProblem.findUnique({
        where: { slug: input.problemSlug },
        select: { id: true },
    })
    if (!problem) return { ok: false, status: 404, error: "Problem not found." }

    // A problem checks exactly one lesson — @@unique([problemId]).
    const claimed = await prisma.lessonCheckpoint.findUnique({
        where: { problemId: problem.id },
        select: { articleId: true },
    })
    if (claimed) {
        return {
            ok: false,
            status: 409,
            error:
                claimed.articleId === articleId
                    ? "That problem is already a checkpoint on this lesson."
                    : "That problem is already a checkpoint on another lesson.",
        }
    }

    try {
        const created = await prisma.$transaction(async (tx) => {
            const current = await tx.lessonCheckpoint.findMany({
                where: { articleId },
                orderBy: { position: "asc" },
                select: { problemId: true, position: true },
            })
            const position = Math.min(
                input.position ?? current.length,
                current.length,
            )
            const toShift = current
                .filter((c) => c.position >= position)
                .sort((a, b) => b.position - a.position)
            for (const c of toShift) {
                await tx.lessonCheckpoint.update({
                    where: {
                        articleId_problemId: { articleId, problemId: c.problemId },
                    },
                    data: { position: c.position + 1 },
                })
            }
            return tx.lessonCheckpoint.create({
                data: { articleId, problemId: problem.id, position },
                select: { problemId: true, position: true },
            })
        })

        return { ok: true, data: created }
    } catch (error) {
        return mapWriteFailure(error, "add checkpoint")
    }
}

export async function removeCheckpoint(
    articleSlug: string,
    problemSlug: string,
): Promise<CurriculumMutationResult> {
    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const checkpoints = await prisma.lessonCheckpoint.findMany({
        where: { articleId },
        orderBy: { position: "asc" },
        select: { problemId: true, problem: { select: { slug: true } } },
    })
    const target = checkpoints.find((c) => c.problem.slug === problemSlug)
    if (!target) {
        return { ok: false, status: 404, error: "Checkpoint not found." }
    }
    const remaining = checkpoints
        .filter((c) => c.problemId !== target.problemId)
        .map((c) => c.problemId)

    try {
        await prisma.$transaction(async (tx) => {
            await tx.lessonCheckpoint.delete({
                where: {
                    articleId_problemId: { articleId, problemId: target.problemId },
                },
            })
            await renumber(remaining, (id, position) =>
                tx.lessonCheckpoint.update({
                    where: { articleId_problemId: { articleId, problemId: id } },
                    data: { position },
                }),
            )
        })
    } catch (error) {
        return mapWriteFailure(error, "remove checkpoint")
    }

    return { ok: true }
}

export async function reorderCheckpoints(
    articleSlug: string,
    problemSlugs: string[],
): Promise<CurriculumMutationResult> {
    const articleId = await findArticleId(articleSlug)
    if (!articleId) return { ok: false, status: 404, error: "Lesson not found." }

    const checkpoints = await prisma.lessonCheckpoint.findMany({
        where: { articleId },
        select: { problemId: true, problem: { select: { slug: true } } },
    })
    const currentSlugs = new Set(checkpoints.map((c) => c.problem.slug))
    const requested = new Set(problemSlugs)
    if (
        problemSlugs.length !== requested.size ||
        !setsEqual(currentSlugs, requested)
    ) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current checkpoint exactly once.",
        }
    }

    const idBySlug = new Map(
        checkpoints.map((c) => [c.problem.slug, c.problemId]),
    )
    const ordered = problemSlugs.map((s) => idBySlug.get(s)!)

    try {
        await prisma.$transaction(async (tx) =>
            renumber(ordered, (id, position) =>
                tx.lessonCheckpoint.update({
                    where: { articleId_problemId: { articleId, problemId: id } },
                    data: { position },
                }),
            ),
        )
    } catch (error) {
        return mapWriteFailure(error, "reorder checkpoints")
    }

    return { ok: true }
}
