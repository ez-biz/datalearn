import { NextResponse } from "next/server"
import { AuthFailure } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"
import { requireDiscussionModerator } from "@/lib/discussions/api-auth"

type Ctx = { params: Promise<{ commentId: string }> }

export async function POST(req: Request, ctx: Ctx) {
    try {
        const principal = await requireDiscussionModerator(req, "HIDE_COMMENT")
        const { commentId } = await ctx.params
        const now = new Date()

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
            if (comment.status !== "VISIBLE") {
                return {
                    ok: false as const,
                    status: 409,
                    error: "Only visible comments can be hidden.",
                }
            }

            const transition = await tx.discussionComment.updateMany({
                where: { id: comment.id, status: "VISIBLE" },
                data: {
                    status: "HIDDEN",
                    hiddenAt: now,
                    hiddenById: principal.userId,
                },
            })
            if (transition.count === 0) {
                return {
                    ok: false as const,
                    status: 409,
                    error: "Comment state changed before it could be hidden.",
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
                await tx.userReputationEvent.upsert({
                    where: {
                        userId_kind_sourceId: {
                            userId: comment.userId,
                            kind: "COMMENT_HIDDEN",
                            sourceId: `moderation:hide:${comment.id}`,
                        },
                    },
                    update: { points: -2 },
                    create: {
                        userId: comment.userId,
                        kind: "COMMENT_HIDDEN",
                        points: -2,
                        sourceId: `moderation:hide:${comment.id}`,
                    },
                })
            }

            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "HIDE_COMMENT",
                    targetType: "COMMENT",
                    targetId: comment.id,
                    note: "Comment hidden from the admin discussion queue.",
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
            data: { action: "HIDE_COMMENT", comment: result.comment },
        })
    } catch (e) {
        if (e instanceof AuthFailure) {
            return NextResponse.json(e.body, { status: e.status })
        }
        console.error("Hide discussion comment failed:", e)
        return NextResponse.json(
            { error: "Internal server error." },
            { status: 500 }
        )
    }
}
