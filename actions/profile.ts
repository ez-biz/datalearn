"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
    buildHeatmap,
    computeStreaks,
    type DayBucket,
    type StreakInfo,
} from "@/lib/profile-stats"

export type ProfileData = {
    user: {
        name: string | null
        email: string | null
        image: string | null
        role: "USER" | "CONTRIBUTOR" | "MODERATOR" | "ADMIN"
        joinedAt: Date
    }
    totals: {
        solved: number
        submissions: number
        accepted: number
        acceptanceRate: number // 0-100
        byDifficulty: { EASY: number; MEDIUM: number; HARD: number }
        totalsByDifficulty: { EASY: number; MEDIUM: number; HARD: number }
    }
    streak: StreakInfo
    heatmap: DayBucket[]
    skills: Array<{
        slug: string
        name: string
        solvedCount: number
        bucket: "advanced" | "intermediate" | "fundamental"
    }>
    recent: Array<{
        id: string
        status: "ACCEPTED" | "WRONG_ANSWER"
        createdAt: Date
        problem: { number: number; slug: string; title: string; difficulty: string }
    }>
}

const HEATMAP_DAYS = 365
const RECENT_LIMIT = 10

/**
 * Aggregated data for the profile page. Composed of cheap Prisma queries
 * plus pure aggregation in the helpers — no extra round-trips beyond what
 * the existing /profile already runs. Returns null when the user isn't
 * signed in.
 */
export async function getProfileData(): Promise<ProfileData | null> {
    const session = await auth()
    if (!session?.user?.id) return null
    const userId = session.user.id

    try {
        const since = new Date(Date.now() - HEATMAP_DAYS * 86_400 * 1000)

        const [
            user,
            heatmapRows,
            submissions,
            accepted,
            recent,
            solvedRows,
            publishedTotals,
            tagRows,
        ] = await Promise.all([
            prisma.user.findUniqueOrThrow({
                where: { id: userId },
                select: {
                    name: true,
                    email: true,
                    image: true,
                    role: true,
                    createdAt: true,
                },
            }),
            // Heatmap input — every submission within the window, only
            // the createdAt timestamp.
            prisma.submission.findMany({
                where: { userId, createdAt: { gte: since } },
                select: { createdAt: true },
            }),
            prisma.submission.count({ where: { userId } }),
            prisma.submission.count({
                where: { userId, status: "ACCEPTED" },
            }),
            prisma.submission.findMany({
                where: { userId },
                select: {
                    id: true,
                    status: true,
                    createdAt: true,
                    problem: {
                        select: {
                            number: true,
                            slug: true,
                            title: true,
                            difficulty: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                take: RECENT_LIMIT,
            }),
            prisma.submission.findMany({
                where: { userId, status: "ACCEPTED" },
                select: {
                    problem: {
                        select: {
                            id: true,
                            difficulty: true,
                            tags: { select: { slug: true, name: true } },
                        },
                    },
                },
                distinct: ["problemId"],
            }),
            prisma.sQLProblem.groupBy({
                by: ["difficulty"],
                where: { status: "PUBLISHED" },
                _count: { _all: true },
            }),
            // For Skills: which tags each PUBLISHED problem has, so we
            // can give a sense of denominator per tag (not just user's
            // count). Used to bucket — see below.
            prisma.tag.findMany({
                select: {
                    slug: true,
                    name: true,
                    _count: {
                        select: {
                            problems: { where: { status: "PUBLISHED" } },
                        },
                    },
                },
            }),
        ])

        // Solved counts by difficulty (distinct problems).
        const byDifficulty = { EASY: 0, MEDIUM: 0, HARD: 0 } as Record<
            "EASY" | "MEDIUM" | "HARD",
            number
        >
        for (const row of solvedRows) {
            const d = row.problem.difficulty as "EASY" | "MEDIUM" | "HARD"
            byDifficulty[d]++
        }

        // Total PUBLISHED counts by difficulty (the denominator).
        const totalsByDifficulty = {
            EASY: 0,
            MEDIUM: 0,
            HARD: 0,
        } as Record<"EASY" | "MEDIUM" | "HARD", number>
        for (const t of publishedTotals) {
            const d = t.difficulty as "EASY" | "MEDIUM" | "HARD"
            totalsByDifficulty[d] = t._count._all
        }

        // Skills: for each tag, count distinct accepted problems that
        // carry that tag. Bucket into Advanced/Intermediate/Fundamental
        // by the user's relative usage — top tertile = Advanced.
        const tagSolvedCount = new Map<string, number>()
        for (const row of solvedRows) {
            for (const tag of row.problem.tags) {
                tagSolvedCount.set(
                    tag.slug,
                    (tagSolvedCount.get(tag.slug) ?? 0) + 1
                )
            }
        }
        const tagMeta = new Map(tagRows.map((t) => [t.slug, t]))
        const tagsRanked = Array.from(tagSolvedCount.entries())
            .map(([slug, solvedCount]) => ({
                slug,
                name: tagMeta.get(slug)?.name ?? slug,
                solvedCount,
            }))
            .sort((a, b) => b.solvedCount - a.solvedCount)

        // Bucket thresholds: top third = advanced, middle = intermediate,
        // bottom = fundamental. Falls back to all-fundamental for new
        // users so the section isn't misleading.
        const skills: ProfileData["skills"] = tagsRanked.map((t, i) => {
            let bucket: "advanced" | "intermediate" | "fundamental" =
                "fundamental"
            if (tagsRanked.length >= 3) {
                const third = tagsRanked.length / 3
                if (i < third) bucket = "advanced"
                else if (i < 2 * third) bucket = "intermediate"
            } else if (tagsRanked.length === 2) {
                bucket = i === 0 ? "advanced" : "intermediate"
            }
            return { ...t, bucket }
        })

        const heatmap = buildHeatmap(
            heatmapRows.map((r) => r.createdAt),
            HEATMAP_DAYS
        )
        const streak = computeStreaks(heatmap)

        return {
            user: {
                name: user.name,
                email: user.email,
                image: user.image,
                role: user.role,
                joinedAt: user.createdAt,
            },
            totals: {
                solved: solvedRows.length,
                submissions,
                accepted,
                acceptanceRate:
                    submissions > 0
                        ? Math.round((accepted / submissions) * 100)
                        : 0,
                byDifficulty,
                totalsByDifficulty,
            },
            streak,
            heatmap,
            skills,
            recent,
        }
    } catch (e) {
        console.error("getProfileData failed:", e)
        return null
    }
}
