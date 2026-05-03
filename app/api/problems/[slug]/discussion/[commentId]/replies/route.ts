import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { DiscussionCommentCreateInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import { checkDiscussionLimit } from "@/lib/discussions/rate-limit"
import {
    publicCommentInclude,
    shapePublicComment,
} from "@/lib/discussions/queries"
import { getUserReputation } from "@/lib/discussions/reputation"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Ctx = { params: Promise<{ slug: string; commentId: string }> }

async function readJson(req: Request): Promise<unknown | null> {
    try {
        return await req.json()
    } catch {
        return null
    }
}

export const POST = withDiscussionAuth(async (req, principal, ctx: Ctx) => {
    const { slug, commentId } = await ctx.params
    const settings = await getDiscussionSettings()

    if (!settings.globalEnabled) {
        return NextResponse.json(
            { error: "Discussions are disabled." },
            { status: 403 }
        )
    }

    const parsed = DiscussionCommentCreateInput.safeParse(await readJson(req))
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

    const parent = await prisma.discussionComment.findFirst({
        where: {
            id: commentId,
            problem: { slug, status: "PUBLISHED" },
            status: { in: ["VISIBLE", "DELETED"] },
        },
        select: {
            id: true,
            problemId: true,
            parentId: true,
            problem: {
                select: {
                    discussionState: { select: { mode: true } },
                },
            },
        },
    })

    if (!parent) {
        return NextResponse.json({ error: "Comment not found." }, { status: 404 })
    }

    if (parent.parentId !== null) {
        return NextResponse.json(
            { error: "Replies can only be added to top-level comments." },
            { status: 409 }
        )
    }

    if ((parent.problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
        return NextResponse.json(
            { error: "Discussion is not open." },
            { status: 403 }
        )
    }

    const reputation = await getUserReputation(principal.userId, settings)
    const limit = await checkDiscussionLimit({
        userId: principal.userId,
        problemId: parent.problemId,
        bodyMarkdown,
        action: "REPLY",
        tier: reputation.tier,
        settings,
    })

    if (!limit.ok) {
        return NextResponse.json({ error: limit.error }, { status: 429 })
    }

    const reply = await prisma.discussionComment.create({
        data: {
            problemId: parent.problemId,
            userId: principal.userId,
            parentId: parent.id,
            bodyMarkdown,
        },
        include: publicCommentInclude(principal.userId),
    })

    return NextResponse.json(
        { data: shapePublicComment(reply) },
        { status: 201 }
    )
})
