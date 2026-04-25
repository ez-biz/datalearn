"use server"

import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { compareResults, type ValidationResult } from "@/lib/sql-validator"

const SubmitSchema = z.object({
    problemSlug: z.string().min(1).max(200),
    userResult: z.array(z.record(z.string(), z.unknown())),
    code: z.string().max(20_000).optional(),
})

export async function validateSubmission(input: unknown): Promise<ValidationResult> {
    const parsed = SubmitSchema.safeParse(input)
    if (!parsed.success) {
        return {
            ok: false,
            reason: "Invalid submission shape. Your result must be an array of row objects.",
        }
    }

    const { problemSlug, userResult, code } = parsed.data

    const problem = await prisma.sQLProblem.findUnique({
        where: { slug: problemSlug },
        select: { id: true, expectedOutput: true, ordered: true },
    })

    if (!problem) {
        return { ok: false, reason: "Problem not found." }
    }

    let expected: unknown
    try {
        expected = JSON.parse(problem.expectedOutput)
    } catch {
        return {
            ok: false,
            reason: "Expected output for this problem is malformed. Report this.",
        }
    }

    const result = compareResults(userResult, expected, { ordered: problem.ordered })

    const session = await auth()
    if (session?.user?.id) {
        try {
            await prisma.submission.create({
                data: {
                    userId: session.user.id,
                    problemId: problem.id,
                    status: result.ok ? "ACCEPTED" : "WRONG_ANSWER",
                    code: code ?? "",
                    reason: result.ok ? null : result.reason ?? null,
                },
            })
        } catch (e) {
            console.error("Failed to persist submission:", e)
        }
    }

    return result
}

export async function getSolvedSlugs(): Promise<string[]> {
    const session = await auth()
    if (!session?.user?.id) return []
    try {
        const rows = await prisma.submission.findMany({
            where: { userId: session.user.id, status: "ACCEPTED" },
            select: { problem: { select: { slug: true } } },
            distinct: ["problemId"],
        })
        return rows.map((r) => r.problem.slug)
    } catch (e) {
        console.error("getSolvedSlugs failed:", e)
        return []
    }
}

export type ProblemHistoryEntry = {
    id: string
    status: "ACCEPTED" | "WRONG_ANSWER"
    code: string
    reason: string | null
    createdAt: Date
}

export async function getProblemHistory(slug: string): Promise<ProblemHistoryEntry[]> {
    const session = await auth()
    if (!session?.user?.id) return []
    try {
        const rows = await prisma.submission.findMany({
            where: {
                userId: session.user.id,
                problem: { slug },
            },
            select: {
                id: true,
                status: true,
                code: true,
                reason: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 25,
        })
        return rows
    } catch (e) {
        console.error("getProblemHistory failed:", e)
        return []
    }
}

export type UserStats = {
    solved: number
    submissions: number
    accepted: number
    byDifficulty: { EASY: number; MEDIUM: number; HARD: number }
    recent: Array<{
        id: string
        status: "ACCEPTED" | "WRONG_ANSWER"
        createdAt: Date
        problem: { slug: string; title: string; difficulty: string }
    }>
}

export async function getUserStats(): Promise<UserStats | null> {
    const session = await auth()
    if (!session?.user?.id) return null
    const userId = session.user.id

    try {
        const [solvedRows, submissions, accepted, recent] = await Promise.all([
            prisma.submission.findMany({
                where: { userId, status: "ACCEPTED" },
                select: { problem: { select: { difficulty: true } } },
                distinct: ["problemId"],
            }),
            prisma.submission.count({ where: { userId } }),
            prisma.submission.count({ where: { userId, status: "ACCEPTED" } }),
            prisma.submission.findMany({
                where: { userId },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    problem: { select: { slug: true, title: true, difficulty: true } },
                },
                orderBy: { createdAt: "desc" },
                take: 10,
            }),
        ])

        const byDifficulty = { EASY: 0, MEDIUM: 0, HARD: 0 }
        for (const row of solvedRows) {
            const d = row.problem.difficulty as "EASY" | "MEDIUM" | "HARD"
            byDifficulty[d]++
        }

        return {
            solved: solvedRows.length,
            submissions,
            accepted,
            byDifficulty,
            recent,
        }
    } catch (e) {
        console.error("getUserStats failed:", e)
        return null
    }
}
