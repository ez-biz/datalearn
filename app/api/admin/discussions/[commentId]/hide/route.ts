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
                select: { id: true, userId: true },
            })
            if (!comment) return null

            const updated = await tx.discussionComment.update({
                where: { id: comment.id },
                data: {
                    status: "HIDDEN",
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

            return updated
        })

        if (!result) {
            return NextResponse.json(
                { error: "Comment not found." },
                { status: 404 }
            )
        }

        return NextResponse.json({
            data: { action: "HIDE_COMMENT", comment: result },
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
