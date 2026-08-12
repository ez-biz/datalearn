// Ordering for community approaches. Pure — no Prisma, no React.

export type SortableApproach = {
    score: number
    verified: boolean
    createdAt: Date
}

/**
 * Score first, verified as the tiebreak, oldest first to settle the rest.
 *
 * Score leads deliberately. `verified` — the author has an ACCEPTED
 * submission on this problem — is a mitigation for the open posting gate,
 * not a ranking signal: a verified approach with a lower score still sits
 * below an unverified one the community rated higher. It only decides
 * between approaches the community rated equally.
 *
 * The final createdAt tiebreak keeps the order stable across renders; two
 * approaches with equal score and equal verification would otherwise swap
 * places depending on how the database happened to return them.
 */
export function sortApproaches<T extends SortableApproach>(approaches: T[]): T[] {
    return [...approaches].sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score
        if (a.verified !== b.verified) return a.verified ? -1 : 1
        return a.createdAt.getTime() - b.createdAt.getTime()
    })
}
