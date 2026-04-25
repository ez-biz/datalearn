"use server"

import { prisma } from "@/lib/prisma"

export async function getProblems() {
    try {
        const problems = await prisma.sQLProblem.findMany({
            orderBy: { title: 'asc' }
        })
        return { success: true, data: problems }
    } catch (error) {
        return { success: false, data: [] }
    }
}

export async function getProblem(slug: string) {
    try {
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug },
            include: { schema: true },
        })
        return { success: true, data: problem }
    } catch (error) {
        return { success: false, data: null }
    }
}
