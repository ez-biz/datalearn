import { NextResponse } from "next/server"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"
import { getDiscussionSettings } from "@/lib/discussions/settings"

const QUEUE_LIMIT = 100

export async function GET(req: Request) {
    try {
        await requireDiscussionModerator(req, "VIEW_DISCUSSION_QUEUE")
        const settings = await getDiscussionSettings()
        const [needsReview, hidden, dismissedReports, spam] = await Promise.all([
            prisma.discussionComment.findMany({
                where: {
                    status: "VISIBLE",
                    reportCount: { gte: settings.reportThreshold },
                },
                orderBy: [{ reportCount: "desc" }, { updatedAt: "desc" }],
                take: QUEUE_LIMIT,
                include: queueInclude(),
            }),
            prisma.discussionComment.findMany({
                where: { status: "HIDDEN" },
                orderBy: [{ hiddenAt: "desc" }, { updatedAt: "desc" }],
                take: QUEUE_LIMIT,
                include: queueInclude(),
            }),
            prisma.discussionComment.findMany({
                where: { reports: { some: { status: "DISMISSED" } } },
                orderBy: { updatedAt: "desc" },
                take: QUEUE_LIMIT,
                include: queueInclude(),
            }),
            prisma.discussionComment.findMany({
                where: { status: "SPAM" },
                orderBy: [{ hiddenAt: "desc" }, { updatedAt: "desc" }],
                take: QUEUE_LIMIT,
                include: queueInclude(),
            }),
        ])

        return NextResponse.json({
            data: { needsReview, hidden, dismissedReports, spam },
            settings: { reportThreshold: settings.reportThreshold },
        })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Discussion queue route error:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}

function queueInclude() {
    return {
        problem: { select: { slug: true, title: true, number: true } },
        user: { select: { id: true, name: true, email: true } },
        reports: {
            orderBy: { createdAt: "desc" as const },
            take: 1,
            include: {
                user: { select: { name: true, email: true } },
            },
        },
    }
}
