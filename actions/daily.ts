"use server"

import { revalidatePath } from "next/cache"
import type { Prisma } from "@prisma/client"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
    addUtcDays,
    normalizeDailyDate,
    parseDailyDateKey,
    selectAutoDailyCandidate,
    toDailyKey,
} from "@/lib/daily-utils"

export type DailyProblemSummary = {
    id: string
    date: Date
    source: "AUTO" | "MANUAL"
    updatedAt: Date
    problem: {
        id: string
        number: number
        slug: string
        title: string
        difficulty: string
    }
}

export type DailyStatus = {
    daily: DailyProblemSummary | null
    solvedToday: boolean
}

const DAILY_SELECT = {
    id: true,
    date: true,
    source: true,
    updatedAt: true,
    problem: {
        select: {
            id: true,
            number: true,
            slug: true,
            title: true,
            difficulty: true,
        },
    },
} satisfies Prisma.DailyProblemSelect

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    )
}

async function findDailyProblem(date: Date): Promise<DailyProblemSummary | null> {
    return prisma.dailyProblem.findUnique({
        where: { date },
        select: DAILY_SELECT,
    })
}

export async function getOrCreateDailyProblem(
    date: Date = new Date()
): Promise<DailyProblemSummary | null> {
    const normalizedDate = normalizeDailyDate(date)

    const existing = await findDailyProblem(normalizedDate)
    if (existing) return existing

    try {
        return await prisma.$transaction(async (tx) => {
            const existingInTransaction = await tx.dailyProblem.findUnique({
                where: { date: normalizedDate },
                select: DAILY_SELECT,
            })
            if (existingInTransaction) return existingInTransaction

            const problems = await tx.sQLProblem.findMany({
                where: { status: "PUBLISHED" },
                orderBy: { number: "asc" },
                select: {
                    id: true,
                    number: true,
                    dailyProblems: {
                        where: { date: { lt: normalizedDate } },
                        orderBy: { date: "desc" },
                        take: 1,
                        select: { date: true },
                    },
                },
            })

            const candidate = selectAutoDailyCandidate(
                problems.map((problem) => ({
                    id: problem.id,
                    number: problem.number,
                    lastDailyAt: problem.dailyProblems[0]?.date ?? null,
                }))
            )
            if (!candidate) return null

            return tx.dailyProblem.create({
                data: {
                    date: normalizedDate,
                    problemId: candidate.id,
                    source: "AUTO",
                },
                select: DAILY_SELECT,
            })
        })
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            return findDailyProblem(normalizedDate)
        }
        throw error
    }
}

export async function getDailyStatusForCurrentUser(
    date?: Date
): Promise<DailyStatus> {
    const [session, daily] = await Promise.all([
        auth(),
        getOrCreateDailyProblem(date),
    ])

    if (!session?.user?.id || !daily) {
        return { daily, solvedToday: false }
    }

    const solved = await prisma.submission.findFirst({
        where: {
            userId: session.user.id,
            problemId: daily.problem.id,
            status: "ACCEPTED",
            createdAt: {
                gte: daily.date,
                lt: addUtcDays(daily.date, 1),
            },
        },
        select: { id: true },
    })

    return { daily, solvedToday: solved !== null }
}

export async function getExistingDailyStatusForCurrentUser(
    date: Date = new Date()
): Promise<DailyStatus> {
    const normalizedDate = normalizeDailyDate(date)
    const [session, daily] = await Promise.all([
        auth(),
        findDailyProblem(normalizedDate),
    ])

    if (!session?.user?.id || !daily) {
        return { daily, solvedToday: false }
    }

    const solved = await prisma.submission.findFirst({
        where: {
            userId: session.user.id,
            problemId: daily.problem.id,
            status: "ACCEPTED",
            createdAt: {
                gte: daily.date,
                lt: addUtcDays(daily.date, 1),
            },
        },
        select: { id: true },
    })

    return { daily, solvedToday: solved !== null }
}

export async function listDailyProblems(
    center: Date = new Date()
): Promise<DailyProblemSummary[]> {
    const session = await auth()
    if (session?.user?.role !== "ADMIN") {
        return []
    }

    const normalizedCenter = normalizeDailyDate(center)
    return prisma.dailyProblem.findMany({
        where: {
            date: {
                gte: addUtcDays(normalizedCenter, -7),
                lte: addUtcDays(normalizedCenter, 14),
            },
        },
        orderBy: { date: "asc" },
        select: DAILY_SELECT,
    })
}

export async function setManualDailyProblem(input: {
    dateKey: string
    problemId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
    const session = await auth()
    if (session?.user?.role !== "ADMIN") {
        return { ok: false, error: "Admin access required." }
    }

    let date: Date
    try {
        date = parseDailyDateKey(input.dateKey)
    } catch (error) {
        return {
            ok: false,
            error:
                error instanceof Error
                    ? error.message
                    : "Daily date is invalid.",
        }
    }

    const problem = await prisma.sQLProblem.findUnique({
        where: { id: input.problemId },
        select: { id: true, status: true },
    })
    if (!problem || problem.status !== "PUBLISHED") {
        return { ok: false, error: "Problem not found." }
    }

    try {
        await prisma.dailyProblem.upsert({
            where: { date },
            create: {
                date,
                problemId: problem.id,
                source: "MANUAL",
            },
            update: {
                problemId: problem.id,
                source: "MANUAL",
            },
        })

        revalidatePath("/")
        revalidatePath("/daily")
        revalidatePath("/admin/daily")

        return { ok: true }
    } catch (error) {
        console.error("setManualDailyProblem failed:", error)
        return { ok: false, error: "Failed to set daily problem." }
    }
}

export { toDailyKey }
