"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
    resolveProblemSolution,
    type SolutionResult,
} from "@/lib/solutions"
import type { Dialect } from "@/lib/sql-engine/types"

/**
 * Returns the canonical SQL solution for `slug` ONLY when the caller has
 * an ACCEPTED submission for that problem. All non-trusted callers
 * (anonymous, signed-in-but-unsolved, unknown-slug) get a `found: false`
 * verdict with a discriminator the client uses to choose a CTA.
 *
 * Solutions are deliberately stripped from `getProblem`'s default projection
 * (see `actions/problems.ts`). This action is the only path that exposes
 * them, and it never trusts client-claimed "I solved this" state — the
 * submission lookup hits the DB.
 *
 * @see lib/solutions.ts for the pure resolver this delegates to.
 */
export async function getProblemSolution(slug: string): Promise<SolutionResult> {
    const session = await auth()
    if (!session?.user?.id) {
        return { found: false, reason: "not-signed-in" }
    }

    return resolveProblemSolution({
        userId: session.user.id,
        slug,
        async findProblem(s) {
            const row = await prisma.sQLProblem.findUnique({
                where: { slug: s },
                select: {
                    id: true,
                    dialects: true,
                    solutions: true,
                    solutionSql: true,
                    contestLock: { select: { problemId: true } },
                },
            })
            if (!row || row.contestLock) return null
            return {
                id: row.id,
                dialects: row.dialects as Dialect[],
                solutions: (row.solutions as Record<string, unknown>) ?? {},
                solutionSql: row.solutionSql ?? null,
            }
        },
        async findSubmission(userId, problemId) {
            return prisma.submission.findFirst({
                where: { userId, problemId, status: "ACCEPTED" },
                select: { id: true },
            })
        },
    })
}
