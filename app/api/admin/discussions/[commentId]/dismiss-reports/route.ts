import { NextResponse } from "next/server"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"

type Ctx = { params: Promise<{ commentId: string }> }

export async function POST(req: Request, ctx: Ctx) {
    try {
        const principal = await requireDiscussionModerator(req, "DISMISS_REPORT")
        const { commentId } = await ctx.params
        const now = new Date()

        const result = await prisma.$transaction(async (tx) => {
            const comment = await tx.discussionComment.findUnique({
                where: { id: commentId },
                select: { id: true, status: true, reportCount: true, score: true },
            })
            if (!comment) return null

            const dismissed = await tx.discussionReport.updateMany({
                where: {
                    commentId: comment.id,
                    status: "OPEN",
                },
                data: {
                    status: "DISMISSED",
                    resolvedAt: now,
                    resolvedById: principal.userId,
                },
            })

            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "DISMISS_REPORT",
                    targetType: "COMMENT",
                    targetId: comment.id,
                    note: `Dismissed ${dismissed.count} open report${
                        dismissed.count === 1 ? "" : "s"
                    }.`,
                },
            })

            return { comment, dismissedCount: dismissed.count }
        })

        if (!result) {
            return NextResponse.json(
                { error: "Comment not found." },
                { status: 404 }
            )
        }

        return NextResponse.json({
            data: {
                action: "DISMISS_REPORT",
                comment: result.comment,
                dismissedCount: result.dismissedCount,
            },
        })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Dismiss discussion reports failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}
