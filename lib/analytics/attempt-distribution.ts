/**
 * How many attempts each solver needed before their first acceptance.
 *
 * This is per-user, not global: submissions from different learners
 * interleave in time, so a single running counter would attribute one
 * person's failures to another. Attempts made *after* a user's first
 * acceptance are ignored — the question is how hard the problem was to
 * solve the first time, and continuing to practise afterwards should not
 * make it look harder.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

export interface AttemptEvent {
    userId: string
    accepted: boolean
}

export interface AttemptBucket {
    /** Submissions up to and including the first acceptance. */
    attempts: number
    /** How many learners solved it in exactly that many attempts. */
    solvers: number
}

/**
 * @param events submissions in chronological order, oldest first
 * @returns buckets ordered by attempt count ascending; users who never
 *          solved the problem are absent, since they have no first solve
 */
export function attemptsToFirstSolve(events: AttemptEvent[]): AttemptBucket[] {
    const attemptsSoFar = new Map<string, number>()
    const solvedAt = new Map<string, number>()

    for (const event of events) {
        // Once a user has solved it, nothing they do later counts.
        if (solvedAt.has(event.userId)) continue

        const next = (attemptsSoFar.get(event.userId) ?? 0) + 1
        attemptsSoFar.set(event.userId, next)
        if (event.accepted) solvedAt.set(event.userId, next)
    }

    const histogram = new Map<number, number>()
    for (const attempts of solvedAt.values()) {
        histogram.set(attempts, (histogram.get(attempts) ?? 0) + 1)
    }

    return [...histogram.entries()]
        .sort(([a], [b]) => a - b)
        .map(([attempts, solvers]) => ({ attempts, solvers }))
}

/** Learners whose very first submission was accepted. Counted once each,
 *  however many times they resubmit afterwards. */
export function firstTryAcceptedCount(events: AttemptEvent[]): number {
    const firstOutcome = new Map<string, boolean>()
    for (const event of events) {
        if (firstOutcome.has(event.userId)) continue
        firstOutcome.set(event.userId, event.accepted)
    }

    let count = 0
    for (const accepted of firstOutcome.values()) {
        if (accepted) count++
    }
    return count
}
