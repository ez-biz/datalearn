"use server"

import { revalidatePath } from "next/cache"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deriveContestStatus } from "@/lib/contest-status"
import { registerContestParticipantUnchecked } from "@/lib/contest-registration"
import { toStandingsRows, type LeaderboardRow } from "@/lib/contests/leaderboard"

const OFFICIAL_KINDS: Array<"WEEKLY" | "BIWEEKLY" | "SPECIAL"> = [
    "WEEKLY",
    "BIWEEKLY",
    "SPECIAL",
]

export type ContestListItem = {
    id: string
    slug: string
    title: string
    description: string
    kind: "WEEKLY" | "BIWEEKLY" | "SPECIAL" | "USER_CUSTOM"
    status: "SCHEDULED" | "LIVE" | "CLOSED"
    startsAt: Date
    endsAt: Date
    durationMinutes: number
    rated: boolean
    problemCount: number
    registrationCount: number
}

export async function listContests(): Promise<ContestListItem[]> {
    const rows = await prisma.contest.findMany({
        where: {
            kind: { in: OFFICIAL_KINDS },
            status: { not: "CANCELLED" },
            visibility: "PUBLIC",
        },
        orderBy: [{ startsAt: "desc" }, { title: "asc" }],
        select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            kind: true,
            status: true,
            startsAt: true,
            endsAt: true,
            durationMinutes: true,
            rated: true,
            _count: { select: { problems: true, registrations: true } },
        },
    })
    const now = new Date()
    return rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        kind: row.kind,
        status: deriveContestStatus(
            row.startsAt,
            row.endsAt,
            row.status,
            now
        ),
        startsAt: row.startsAt,
        endsAt: row.endsAt,
        durationMinutes: row.durationMinutes,
        rated: row.rated,
        problemCount: row._count.problems,
        registrationCount: row._count.registrations,
    }))
}

export async function getContestBySlug(slug: string) {
    const row = await prisma.contest.findUnique({
        where: { slug },
        select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            kind: true,
            status: true,
            startsAt: true,
            endsAt: true,
            durationMinutes: true,
            rated: true,
            visibility: true,
            maxParticipants: true,
            problems: {
                orderBy: { position: "asc" },
                select: {
                    position: true,
                    points: true,
                    problem: {
                        select: {
                            id: true,
                            number: true,
                            slug: true,
                            title: true,
                            difficulty: true,
                        },
                    },
                },
            },
            _count: { select: { registrations: true } },
        },
    })
    if (
        !row ||
        row.kind === "USER_CUSTOM" ||
        row.status === "CANCELLED" ||
        row.visibility !== "PUBLIC"
    ) {
        return null
    }

    const status = deriveContestStatus(row.startsAt, row.endsAt, row.status)
    return {
        ...row,
        status,
        registrationCount: row._count.registrations,
        problemCount: row.problems.length,
        problems: status === "SCHEDULED" ? [] : row.problems,
    }
}

export async function registerForContest(args: {
    contestId: string
}): Promise<{ status: "registered" | "already_registered" }> {
    const session = await auth()
    if (!session?.user?.id) {
        throw new Error("AUTH_REQUIRED")
    }
    // Per-user rate limit to curb registration spam across many contests.
    const recent = await prisma.contestRegistration.count({
        where: {
            userId: session.user.id,
            registeredAt: { gte: new Date(Date.now() - 60_000) },
        },
    })
    if (recent >= 30) {
        throw new Error("RATE_LIMITED")
    }
    const result = await registerContestParticipantUnchecked({
        contestId: args.contestId,
        userId: session.user.id,
    })
    revalidatePath("/contests")
    return result
}

/**
 * Standings for a contest, ordered by ICPC tie-break (points desc, penalty asc,
 * then userId for stable ties). Returns [] on error so the page never breaks.
 * Never selects user email.
 */
export async function getContestLeaderboard(
    contestId: string
): Promise<LeaderboardRow[]> {
    try {
        const entries = await prisma.contestLeaderboardEntry.findMany({
            where: { contestId },
            orderBy: [
                { points: "desc" },
                { penaltySeconds: "asc" },
                { userId: "asc" },
            ],
            select: {
                userId: true,
                points: true,
                penaltySeconds: true,
                solvedCount: true,
                user: { select: { id: true, name: true } },
            },
        })
        return toStandingsRows(entries)
    } catch (error) {
        console.error("[getContestLeaderboard]", error)
        return []
    }
}
