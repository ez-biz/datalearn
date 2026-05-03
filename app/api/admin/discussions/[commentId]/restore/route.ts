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
                select: { id: true },
            })
            if (!comment) return null

            const updated = await tx.discussionComment.update({
                where: { id: comment.id },
                data: {
                    status: "VISIBLE",
                    hiddenAt: null,
                    hiddenById: null,
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

            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "RESTORE_COMMENT",
                    targetType: "COMMENT",
                    targetId: comment.id,
                    note: "Comment restored to visible.",
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
            data: { action: "RESTORE_COMMENT", comment: result },
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
