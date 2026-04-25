"use server"

import { prisma } from "@/lib/prisma"

/**
 * Public problem listing — only PUBLISHED problems.
 *
 * SECURITY: explicit `select` to keep `expectedOutput` (the answer key)
 * and `solutionSql` (the canonical answer query) off the wire.
 * Anything in this projection is shipped to the browser via the page's
 * server-rendered HTML, so the field list is the public contract.
 *
 * Admin views go through /api/admin/problems instead.
 */
export async function getProblems() {
    try {
        const problems = await prisma.sQLProblem.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { title: "asc" },
            select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                difficulty: true,
            },
        })
        return { success: true, data: problems }
    } catch (error) {
        return { success: false, data: [] }
    }
}

/**
 * Public problem detail — only PUBLISHED problems are exposed by slug.
 * Returns null for DRAFT/BETA/ARCHIVED so user-facing pages 404.
 *
 * SECURITY: `expectedOutput` is included server-side only — the page
 * parses it into a small column/row preview that gets passed to the
 * client. The full string is never serialized into the React tree.
 * `solutionSql` is intentionally excluded entirely.
 */
export async function getProblem(slug: string) {
    try {
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug },
            select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                difficulty: true,
                status: true,
                schemaDescription: true,
                schemaId: true,
                schema: { select: { id: true, name: true, sql: true } },
                expectedOutput: true,
                ordered: true,
                hints: true,
                createdAt: true,
                updatedAt: true,
            },
        })
        if (!problem || problem.status !== "PUBLISHED") {
            return { success: true, data: null }
        }
        return { success: true, data: problem }
    } catch (error) {
        return { success: false, data: null }
    }
}
