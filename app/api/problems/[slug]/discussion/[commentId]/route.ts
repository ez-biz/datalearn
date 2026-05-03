import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { DiscussionCommentEditInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import {
    publicCommentInclude,
    shapePublicComment,
} from "@/lib/discussions/queries"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Ctx = { params: Promise<{ slug: string; commentId: string }> }

async function readJson(req: Request): Promise<unknown | null> {
    try {
        return await req.json()
    } catch {
        return null
    }
}

async function findOwnedComment(slug: string, commentId: string, userId: string) {
    return prisma.discussionComment.findFirst({
        where: {
            id: commentId,
            userId,
            problem: { slug, status: "PUBLISHED" },
        },
        select: {
            id: true,
            status: true,
            createdAt: true,
        },
    })
}

export const PATCH = withDiscussionAuth(async (req, principal, ctx: Ctx) => {
    const { slug, commentId } = await ctx.params
    const settings = await getDiscussionSettings()

    const parsed = DiscussionCommentEditInput.safeParse(await readJson(req))
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const bodyMarkdown = parsed.data.bodyMarkdown.trim()
    if (bodyMarkdown.length > settings.bodyMaxChars) {
        return NextResponse.json(
            {
                error: `Comment must be ${settings.bodyMaxChars} characters or fewer.`,
            },
            { status: 400 }
        )
    }

    const comment = await findOwnedComment(slug, commentId, principal.userId)
    if (!comment) {
        return NextResponse.json({ error: "Comment not found." }, { status: 404 })
    }

    if (comment.status !== "VISIBLE") {
        return NextResponse.json(
            { error: "Only visible comments can be edited." },
            { status: 409 }
        )
    }

    const editWindowMs = settings.editWindowMinutes * 60 * 1000
    if (Date.now() - comment.createdAt.getTime() > editWindowMs) {
        return NextResponse.json(
            { error: "The edit window for this comment has expired." },
            { status: 403 }
        )
    }

    const updated = await prisma.discussionComment.update({
        where: { id: comment.id },
        data: {
            bodyMarkdown,
            editedAt: new Date(),
        },
        include: publicCommentInclude(principal.userId),
    })

    return NextResponse.json({ data: shapePublicComment(updated) })
})

export const DELETE = withDiscussionAuth(async (_req, principal, ctx: Ctx) => {
    const { slug, commentId } = await ctx.params
    const comment = await findOwnedComment(slug, commentId, principal.userId)
    if (!comment) {
        return NextResponse.json({ error: "Comment not found." }, { status: 404 })
    }

    const updated = await prisma.discussionComment.update({
        where: { id: comment.id },
        data: {
            status: "DELETED",
            bodyMarkdown: "",
            deletedAt: new Date(),
        },
        include: publicCommentInclude(principal.userId),
    })

    return NextResponse.json({ data: shapePublicComment(updated) })
})
