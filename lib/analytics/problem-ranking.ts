/**
 * Ranking for the per-problem performance table.
 *
 * The table exists to find broken or badly-worded problems, so it leads
 * with the worst acceptance rate. The subtlety is what to do with a
 * problem nobody has attempted: its rate is 0/0, and treating that as 0%
 * would flood the top of the table with untried problems and bury the
 * genuinely broken ones. Untried means unknown, so those sort last.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

export interface AcceptanceCounts {
    attempts: number
    accepted: number
}

/** Share from 0 through 1, or null when nobody has attempted the problem.
 *  Never NaN, and never a fabricated zero. */
export function acceptanceRate(counts: AcceptanceCounts): number | null {
    if (counts.attempts === 0) return null
    return counts.accepted / counts.attempts
}

export interface RankableProblem extends AcceptanceCounts {
    number: number
}

/**
 * Worst acceptance first; untried problems last, ordered by number.
 *
 * Equal rates are broken by attempt count descending, so the more
 * heavily-evidenced problem leads — 50/100 is a stronger signal than 2/4.
 * Returns a new array; the input is not mutated.
 */
export function rankByAcceptance<T extends RankableProblem>(rows: T[]): T[] {
    return [...rows].sort((a, b) => {
        const rateA = acceptanceRate(a)
        const rateB = acceptanceRate(b)

        // Untried sinks to the bottom regardless of the other's rate.
        if (rateA === null && rateB === null) return a.number - b.number
        if (rateA === null) return 1
        if (rateB === null) return -1

        if (rateA !== rateB) return rateA - rateB
        if (a.attempts !== b.attempts) return b.attempts - a.attempts
        return a.number - b.number
    })
}
