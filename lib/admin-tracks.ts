import { prisma } from "@/lib/prisma"

export type TrackMutationResult<T = void> =
    | (T extends void ? { ok: true } : { ok: true; data: T })
    | { ok: false; status: number; error: string }

function setsEqual(left: Set<string>, right: Set<string>): boolean {
    if (left.size !== right.size) return false
    for (const value of left) {
        if (!right.has(value)) return false
    }
    return true
}

export async function addTrackItemToTrack(
    trackSlug: string,
    input: { problemSlug: string; position?: number },
): Promise<TrackMutationResult<{ id: string }>> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: { id: true },
    })
    if (!track) return { ok: false, status: 404, error: "Track not found." }

    const problem = await prisma.sQLProblem.findFirst({
        where: { slug: input.problemSlug, status: "PUBLISHED" },
        select: { id: true },
    })
    if (!problem) {
        return { ok: false, status: 404, error: "Problem not found." }
    }

    const existing = await prisma.trackItem.findUnique({
        where: {
            trackId_problemId: {
                trackId: track.id,
                problemId: problem.id,
            },
        },
        select: { id: true },
    })
    if (existing) {
        return {
            ok: false,
            status: 409,
            error: "Problem already exists in this track.",
        }
    }

    const created = await prisma.$transaction(async (tx) => {
        const currentItems = await tx.trackItem.findMany({
            where: { trackId: track.id },
            orderBy: { position: "asc" },
            select: { id: true, position: true },
        })
        const position = Math.min(
            input.position ?? currentItems.length,
            currentItems.length,
        )

        const itemsToShift = currentItems
            .filter((item) => item.position >= position)
            .sort((a, b) => b.position - a.position)
        for (const item of itemsToShift) {
            await tx.trackItem.update({
                where: { id: item.id },
                data: { position: item.position + 1 },
            })
        }

        return tx.trackItem.create({
            data: {
                trackId: track.id,
                problemId: problem.id,
                position,
            },
            select: { id: true },
        })
    })

    return { ok: true, data: { id: created.id } }
}

export async function reorderTrackItems(
    trackSlug: string,
    itemIds: string[],
): Promise<TrackMutationResult> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: {
            id: true,
            items: { select: { id: true } },
        },
    })
    if (!track) return { ok: false, status: 404, error: "Track not found." }

    const currentIds = new Set(track.items.map((item) => item.id))
    const requestedIds = new Set(itemIds)
    if (itemIds.length !== requestedIds.size || !setsEqual(currentIds, requestedIds)) {
        return {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current track item exactly once.",
        }
    }

    await prisma.$transaction(async (tx) => {
        for (let index = 0; index < itemIds.length; index++) {
            await tx.trackItem.update({
                where: { id: itemIds[index] },
                data: { position: -index - 1 },
            })
        }
        for (let index = 0; index < itemIds.length; index++) {
            await tx.trackItem.update({
                where: { id: itemIds[index] },
                data: { position: index },
            })
        }
    })

    return { ok: true }
}

export async function removeTrackItem(
    trackSlug: string,
    itemId: string,
): Promise<TrackMutationResult> {
    const track = await prisma.track.findUnique({
        where: { slug: trackSlug },
        select: {
            id: true,
            items: {
                orderBy: { position: "asc" },
                select: { id: true },
            },
        },
    })
    if (!track) return { ok: false, status: 404, error: "Track not found." }
    if (!track.items.some((item) => item.id === itemId)) {
        return { ok: false, status: 404, error: "Track item not found." }
    }

    const remainingIds = track.items
        .map((item) => item.id)
        .filter((id) => id !== itemId)

    await prisma.$transaction(async (tx) => {
        await tx.trackItem.delete({ where: { id: itemId } })
        for (let index = 0; index < remainingIds.length; index++) {
            await tx.trackItem.update({
                where: { id: remainingIds[index] },
                data: { position: index },
            })
        }
    })

    return { ok: true }
}
