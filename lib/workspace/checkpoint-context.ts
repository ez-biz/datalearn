// Pure checkpoint-position arithmetic for the workspace's lesson context
// bar. No React, no Prisma — the Prisma walk lives in actions/workspace.ts
// and hands its rows to this function.

export type CheckpointSibling = {
    problemSlug: string
    /** 0-indexed, as LessonCheckpoint.position is stored. */
    position: number
}

export type CheckpointPosition = {
    /** 1-based, for "Checkpoint 1 of 2". */
    index: number
    total: number
    /** Next checkpoint in this lesson, or null when this is the last one. */
    nextProblemSlug: string | null
}

/**
 * Where a problem sits among its lesson's checkpoints.
 *
 * Unambiguous in a way the reader's breadcrumb is not: LessonCheckpoint is
 * @@unique([problemId]), so a problem belongs to at most one lesson and
 * there is no lowest-position tiebreak to apply.
 *
 * Returns null when the problem is not among the siblings — the caller then
 * renders no context bar at all, which is also what a catalog-only problem
 * with no curriculum link gets.
 */
export function resolveCheckpointPosition(
    siblings: CheckpointSibling[],
    problemSlug: string
): CheckpointPosition | null {
    // Copy before sorting: the caller's array is Prisma output that other
    // consumers on the page may still read.
    const ordered = [...siblings].sort((a, b) => a.position - b.position)
    const at = ordered.findIndex((s) => s.problemSlug === problemSlug)
    if (at === -1) return null
    return {
        index: at + 1,
        total: ordered.length,
        nextProblemSlug: ordered[at + 1]?.problemSlug ?? null,
    }
}
