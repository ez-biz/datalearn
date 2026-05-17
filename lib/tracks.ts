import { prisma } from "@/lib/prisma"

export type TrackProgress = {
    completedCount: number
    totalCount: number
    nextItemId: string | null
}

export async function getTrackProgressForUser(
    trackId: string,
    userId: string | null,
): Promise<TrackProgress> {
    const items = await prisma.trackItem.findMany({
        where: {
            trackId,
            problem: { status: "PUBLISHED" },
        },
        orderBy: { position: "asc" },
        select: { id: true, problemId: true },
    })
    if (items.length === 0) {
        return { completedCount: 0, totalCount: 0, nextItemId: null }
    }

    if (!userId) {
        return {
            completedCount: 0,
            totalCount: items.length,
            nextItemId: items[0].id,
        }
    }

    const accepted = await prisma.submission.findMany({
        where: {
            userId,
            status: "ACCEPTED",
            problemId: { in: items.map((item) => item.problemId) },
        },
        select: { problemId: true },
        distinct: ["problemId"],
    })
    const completedProblemIds = new Set(accepted.map((row) => row.problemId))
    const nextItem = items.find(
        (item) => !completedProblemIds.has(item.problemId),
    )

    return {
        completedCount: completedProblemIds.size,
        totalCount: items.length,
        nextItemId: nextItem?.id ?? null,
    }
}
