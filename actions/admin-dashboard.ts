"use server"

import { prisma } from "@/lib/prisma"

export type AdminMetric = {
    label: string
    value: number
    href: string
}

export type AdminActivityItem = {
    id: string
    kind: "submission" | "article-submitted" | "problem-reported"
    label: string
    detail: string
    timestamp: Date
    href: string
}

export async function getAdminDashboardMetrics(): Promise<AdminMetric[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [
        problemCount,
        articleCount,
        trackCount,
        contestCount,
        submissionsLast7d,
        pendingReports,
        pendingArticles,
    ] = await Promise.all([
        prisma.sQLProblem.count(),
        prisma.article.count({ where: { status: "PUBLISHED" } }),
        prisma.track.count({ where: { status: "PUBLISHED" } }),
        prisma.contest.count(),
        prisma.submission.count({
            where: { createdAt: { gte: sevenDaysAgo } },
        }),
        prisma.problemReport.count({ where: { resolvedAt: null } }),
        prisma.article.count({ where: { status: "SUBMITTED" } }),
    ])

    return [
        { label: "Problems", value: problemCount, href: "/admin/problems" },
        { label: "Articles", value: articleCount, href: "/admin/articles" },
        { label: "Tracks", value: trackCount, href: "/admin/tracks" },
        { label: "Contests", value: contestCount, href: "/admin/contests" },
        {
            label: "Submissions (7d)",
            value: submissionsLast7d,
            href: "/admin/problems",
        },
        { label: "Open reports", value: pendingReports, href: "/admin/reports" },
        {
            label: "Pending review",
            value: pendingArticles,
            href: "/admin/articles?status=SUBMITTED",
        },
    ]
}

export async function getAdminRecentActivity(
    limit = 12
): Promise<AdminActivityItem[]> {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    const [recentSubmissions, recentArticles, recentReports] = await Promise.all([
        prisma.submission.findMany({
            where: { createdAt: { gte: since }, status: "ACCEPTED" },
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                user: { select: { name: true, email: true } },
                problem: { select: { slug: true, number: true, title: true } },
            },
        }),
        prisma.article.findMany({
            where: { status: "SUBMITTED", updatedAt: { gte: since } },
            take: limit,
            orderBy: { updatedAt: "desc" },
            include: { author: { select: { name: true, email: true } } },
        }),
        prisma.problemReport.findMany({
            where: { createdAt: { gte: since } },
            take: limit,
            orderBy: { createdAt: "desc" },
            include: {
                problem: { select: { slug: true, number: true, title: true } },
            },
        }),
    ])

    const items: AdminActivityItem[] = []
    for (const submission of recentSubmissions) {
        items.push({
            id: `submission-${submission.id}`,
            kind: "submission",
            label: "Submission accepted",
            detail: `${submission.user.name ?? submission.user.email} · #${String(
                submission.problem.number
            ).padStart(3, "0")} ${submission.problem.title}`,
            timestamp: submission.createdAt,
            href: `/practice/${submission.problem.slug}`,
        })
    }
    for (const article of recentArticles) {
        items.push({
            id: `article-${article.id}`,
            kind: "article-submitted",
            label: "Article submitted for review",
            detail: `${article.author.name ?? article.author.email} · ${
                article.title
            }`,
            timestamp: article.updatedAt,
            href: `/admin/articles/${article.slug}/edit`,
        })
    }
    for (const report of recentReports) {
        items.push({
            id: `report-${report.id}`,
            kind: "problem-reported",
            label: "Problem reported",
            detail: `#${String(report.problem.number).padStart(3, "0")} ${
                report.problem.title
            }`,
            timestamp: report.createdAt,
            href: "/admin/reports",
        })
    }

    return items
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit)
}
