/**
 * Pure resolver behind the `getProblemSolution` server action.
 *
 * The platform deliberately gates the canonical SQL solution behind a
 * server-verified "user has solved this problem" check — solutions are
 * never sent to the client up front (see `actions/problems.ts`, which
 * strips `solutionSql` and `solutions` from `getProblem`'s projection).
 * This function encodes that gating contract.
 *
 * Splitting the prisma + auth bits from this resolver keeps the branching
 * unit-testable: the server-action layer injects the lookups, this
 * function returns the verdict.
 */

import type { Dialect } from "@/lib/sql-engine/types"

export type SolutionResult =
    | { found: true; solutions: Record<string, string> }
    | { found: false; reason: "not-signed-in" | "not-solved" | "not-found" }

type ProblemRow = {
    id: string
    dialects: Dialect[]
    /**
     * Per-dialect canonical solutions. Source of truth as of v0.4.2.
     * Shape `{ DUCKDB: "...", POSTGRES: "..." }`. Stored as `Json`, so
     * runtime values are intentionally typed `unknown` and validated
     * before they enter the response.
     */
    solutions: Record<string, unknown>
    /** Legacy single-dialect fallback. Used when a dialect is absent from `solutions`. */
    solutionSql: string | null
}

type Submission = { id: string } | null

export type ResolveProblemSolutionDeps = {
    userId: string
    slug: string
    findProblem: (slug: string) => Promise<ProblemRow | null>
    findSubmission: (
        userId: string,
        problemId: string
    ) => Promise<Submission>
}

export async function resolveProblemSolution(
    deps: ResolveProblemSolutionDeps
): Promise<SolutionResult> {
    const problem = await deps.findProblem(deps.slug)
    if (!problem) return { found: false, reason: "not-found" }

    const submission = await deps.findSubmission(deps.userId, problem.id)
    if (!submission) return { found: false, reason: "not-solved" }

    const solutions: Record<string, string> = {}
    const perDialect = problem.solutions ?? {}
    for (const dialect of problem.dialects) {
        const value = perDialect[dialect]
        if (typeof value === "string" && value.trim().length > 0) {
            solutions[dialect] = value
        } else if (problem.solutionSql && problem.solutionSql.trim().length > 0) {
            solutions[dialect] = problem.solutionSql
        }
        // Else: omit this dialect. A future authoring lint will flag any
        // PUBLISHED problem that ends up with an empty `solutions` map.
    }

    return { found: true, solutions }
}
