// Pure filter model for the admin problems list. No Prisma, no React, no
// next/*, no DOM — importable from a plain `node --import tsx --test` run
// with no database. Filtering happens client-side over the already-loaded
// rows (the list is small at current scale), so this only ever narrows an
// in-memory array; it never talks to the network.

export type ProblemStatusFilter = "ALL" | "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"

export interface FilterableProblem {
    number: number
    title: string
    slug: string
    status: string
}

/**
 * Case-insensitive match on title or slug, plus status. Both narrow: a
 * query that matches nothing returns `[]`, never the unfiltered list — a
 * filter that silently falls back to "everything" on a miss reads as
 * broken search, not as an empty result.
 */
export function filterProblems<T extends FilterableProblem>(
    problems: T[],
    query: string,
    status: ProblemStatusFilter
): T[] {
    const needle = query.trim().toLowerCase()

    return problems.filter((problem) => {
        if (status !== "ALL" && problem.status !== status) return false
        if (!needle) return true
        return (
            problem.title.toLowerCase().includes(needle) ||
            problem.slug.toLowerCase().includes(needle)
        )
    })
}
