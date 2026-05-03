import { NextResponse } from "next/server"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"

type Ctx = { params: Promise<{ commentId: string }> }

export async function POST(req: Request, ctx: Ctx) {
    try {
        const principal = await requireDiscussionModerator(req, "RESTORE_COMMENT")
        const { commentId } = await ctx.params

        const result = await prisma.$transaction(async (tx) => {
            const comment = await tx.discussionComment.findUnique({
                where: { id: commentId },
                select: { id: true, status: true, userId: true },
            })
            if (!comment) {
                return {
                    ok: false as const,
                    status: 404,
                    error: "Comment not found.",
                }
            }
            if (comment.status !== "HIDDEN" && comment.status !== "SPAM") {
                return {
                    ok: false as const,
                    status: 409,
                    error: "Only hidden or spam comments can be restored.",
                }
            }

            const transition = await tx.discussionComment.updateMany({
                where: { id: comment.id, status: { in: ["HIDDEN", "SPAM"] } },
                data: {
                    status: "VISIBLE",
                    hiddenAt: null,
                    hiddenById: null,
                },
            })
            if (transition.count === 0) {
                return {
                    ok: false as const,
                    status: 409,
                    error: "Comment state changed before it could be restored.",
                }
            }

            const updated = await tx.discussionComment.findUniqueOrThrow({
                where: { id: comment.id },
                select: {
                    id: true,
                    status: true,
                    hiddenAt: true,
                    hiddenById: true,
                    reportCount: true,
                    score: true,
                },
            })

            if (comment.userId) {
                await tx.userReputationEvent.deleteMany({
                    where: {
                        userId: comment.userId,
                        OR: [
                            {
                                kind: "COMMENT_HIDDEN",
                                sourceId: `moderation:hide:${comment.id}`,
                            },
                            {
                                kind: "COMMENT_SPAM_CONFIRMED",
                                sourceId: `moderation:spam:${comment.id}`,
                            },
                        ],
                    },
                })
            }

            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "RESTORE_COMMENT",
                    targetType: "COMMENT",
                    targetId: comment.id,
                    note: "Comment restored to visible.",
                },
            })

            return { ok: true as const, comment: updated }
        })

        if (!result.ok) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }

        return NextResponse.json({
            data: { action: "RESTORE_COMMENT", comment: result.comment },
        })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Restore discussion comment failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}
