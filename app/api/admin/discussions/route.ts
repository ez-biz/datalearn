import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"
import { getDiscussionSettings } from "@/lib/discussions/settings"

const QUEUE_LIMIT = 100

export async function GET(req: Request) {
    try {
        await requireDiscussionModerator(req, "VIEW_DISCUSSION_QUEUE")
        const settings = await getDiscussionSettings()
        const needsReviewIdsPromise = findNeedsReviewCommentIds(
            settings.reportThreshold
        )
        const [needsReview, hidden, dismissedReports, spam] = await Promise.all([
            needsReviewIdsPromise.then(loadCommentsInOrder),
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

async function findNeedsReviewCommentIds(reportThreshold: number) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT c."id"
        FROM "DiscussionComment" c
        INNER JOIN "DiscussionReport" r
          ON r."commentId" = c."id"
         AND r."status" = 'OPEN'::"DiscussionReportStatus"
        WHERE c."status" = 'VISIBLE'::"DiscussionCommentStatus"
        GROUP BY c."id", c."updatedAt"
        HAVING COUNT(r."id") >= ${reportThreshold}
        ORDER BY COUNT(r."id") DESC, c."updatedAt" DESC
        LIMIT ${QUEUE_LIMIT}
    `)

    return rows.map((row) => row.id)
}

async function loadCommentsInOrder(ids: string[]) {
    if (ids.length === 0) return []

    const comments = await prisma.discussionComment.findMany({
        where: { id: { in: ids } },
        include: queueInclude(),
    })
    const byId = new Map(comments.map((comment) => [comment.id, comment]))

    return ids.flatMap((id) => {
        const comment = byId.get(id)
        return comment ? [comment] : []
    })
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
