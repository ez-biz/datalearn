"use server"

import { prisma } from "@/lib/prisma"

/**
 * Public problem listing — only PUBLISHED problems.
 * Admin views go through /api/admin/problems instead.
 */
export async function getProblems() {
    try {
        const problems = await prisma.sQLProblem.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { title: "asc" },
        })
        return { success: true, data: problems }
    } catch (error) {
        return { success: false, data: [] }
    }
}

/**
 * Public problem detail — only PUBLISHED problems are exposed by slug.
 * Returns null for DRAFT/BETA/ARCHIVED so user-facing pages 404.
 */
export async function getProblem(slug: string) {
    try {
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug },
            include: { schema: true },
        })
        if (!problem || problem.status !== "PUBLISHED") {
            return { success: true, data: null }
        }
        return { success: true, data: problem }
    } catch (error) {
        return { success: false, data: null }
    }
}
