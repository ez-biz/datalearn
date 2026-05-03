import { NextResponse } from "next/server"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"

type Ctx = { params: Promise<{ commentId: string }> }

export async function POST(req: Request, ctx: Ctx) {
    try {
        const principal = await requireDiscussionModerator(req, "MARK_SPAM")
        const { commentId } = await ctx.params
        const now = new Date()

        const result = await prisma.$transaction(async (tx) => {
            const comment = await tx.discussionComment.findUnique({
                where: { id: commentId },
                select: { id: true, userId: true },
            })
            if (!comment) return null

            const updated = await tx.discussionComment.update({
                where: { id: comment.id },
                data: {
                    status: "SPAM",
                    hiddenAt: now,
                    hiddenById: principal.userId,
                },
                select: {
                    id: true,
                    status: true,
                    hiddenAt: true,
                    hiddenById: true,
                    reportCount: true,
                    score: true,
                },
            })

            const confirmed = await tx.discussionReport.updateMany({
                where: {
                    commentId: comment.id,
                    status: "OPEN",
                },
                data: {
                    status: "CONFIRMED",
                    resolvedAt: now,
                    resolvedById: principal.userId,
                },
            })

            if (comment.userId) {
                await tx.userReputationEvent.upsert({
                    where: {
                        userId_kind_sourceId: {
                            userId: comment.userId,
                            kind: "COMMENT_SPAM_CONFIRMED",
                            sourceId: `moderation:spam:${comment.id}`,
                        },
                    },
                    update: { points: -5 },
                    create: {
                        userId: comment.userId,
                        kind: "COMMENT_SPAM_CONFIRMED",
                        points: -5,
                        sourceId: `moderation:spam:${comment.id}`,
                    },
                })
            }

            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "MARK_SPAM",
                    targetType: "COMMENT",
                    targetId: comment.id,
                    note: `Marked as spam and confirmed ${confirmed.count} open report${
                        confirmed.count === 1 ? "" : "s"
                    }.`,
                },
            })

            return { comment: updated, confirmedCount: confirmed.count }
        })

        if (!result) {
            return NextResponse.json(
                { error: "Comment not found." },
                { status: 404 }
            )
        }

        return NextResponse.json({
            data: {
                action: "MARK_SPAM",
                comment: result.comment,
                confirmedCount: result.confirmedCount,
            },
        })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Mark discussion comment spam failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}
