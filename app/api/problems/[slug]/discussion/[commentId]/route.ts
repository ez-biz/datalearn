import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { DiscussionCommentEditInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import {
    publicCommentInclude,
    shapePublicComment,
} from "@/lib/discussions/queries"
import { getDiscussionSettings } from "@/lib/discussions/settings"
import { DISCUSSION_SETTINGS_ID } from "@/lib/discussions/constants"

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
            problem: {
                select: {
                    discussionState: { select: { mode: true } },
                },
            },
        },
    })
}

function openPublishedProblemWhere(slug: string) {
    return {
        slug,
        status: "PUBLISHED" as const,
        OR: [
            { discussionState: null },
            { discussionState: { mode: "OPEN" as const } },
        ],
    }
}

async function lockDiscussionSettings(tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<
        Array<{
            globalEnabled: boolean
            bodyMaxChars: number
            editWindowMinutes: number
        }>
    >(Prisma.sql`
        SELECT "globalEnabled", "bodyMaxChars", "editWindowMinutes"
        FROM "DiscussionSettings"
        WHERE "id" = ${DISCUSSION_SETTINGS_ID}
        FOR UPDATE
    `)

    return rows[0] ?? null
}

export const PATCH = withDiscussionAuth(async (req, principal, ctx: Ctx) => {
    const { slug, commentId } = await ctx.params
    await getDiscussionSettings()

    const parsed = DiscussionCommentEditInput.safeParse(await readJson(req))
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const bodyMarkdown = parsed.data.bodyMarkdown.trim()

    const result = await prisma.$transaction(async (tx) => {
        const settings = await lockDiscussionSettings(tx)
        if (!settings?.globalEnabled) {
            return {
                ok: false as const,
                error: "Discussions are disabled.",
                status: 403,
            }
        }

        if (bodyMarkdown.length > settings.bodyMaxChars) {
            return {
                ok: false as const,
                error: `Comment must be ${settings.bodyMaxChars} characters or fewer.`,
                status: 400,
            }
        }

        const editWindowMs = settings.editWindowMinutes * 60 * 1000
        const editSince = new Date(Date.now() - editWindowMs)
        const update = await tx.discussionComment.updateMany({
            where: {
                id: commentId,
                userId: principal.userId,
                status: "VISIBLE",
                createdAt: { gte: editSince },
                problem: openPublishedProblemWhere(slug),
            },
            data: {
                bodyMarkdown,
                editedAt: new Date(),
            },
        })

        if (update.count === 0) {
            return { ok: false as const, error: "Comment not updated.", status: 409 }
        }

        const updated = await tx.discussionComment.findUniqueOrThrow({
            where: { id: commentId },
            include: publicCommentInclude(principal.userId),
        })

        return { ok: true as const, data: shapePublicComment(updated) }
    })

    if (!result.ok) {
        if (result.error !== "Comment not updated.") {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }
        const comment = await findOwnedComment(slug, commentId, principal.userId)
        if (!comment) {
            return NextResponse.json({ error: "Comment not found." }, { status: 404 })
        }
        if ((comment.problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
            return NextResponse.json(
                { error: "Discussion is not open." },
                { status: 403 }
            )
        }
        if (comment.status !== "VISIBLE") {
            return NextResponse.json(
                { error: "Only visible comments can be edited." },
                { status: 409 }
            )
        }
        return NextResponse.json(
            { error: "The edit window for this comment has expired." },
            { status: 403 }
        )
    }

    return NextResponse.json({ data: result.data })
})

export const DELETE = withDiscussionAuth(async (_req, principal, ctx: Ctx) => {
    const { slug, commentId } = await ctx.params
    await getDiscussionSettings()

    const result = await prisma.$transaction(async (tx) => {
        const settings = await lockDiscussionSettings(tx)
        if (!settings?.globalEnabled) {
            return {
                ok: false as const,
                error: "Discussions are disabled.",
                status: 403,
            }
        }

        const update = await tx.discussionComment.updateMany({
            where: {
                id: commentId,
                userId: principal.userId,
                status: "VISIBLE",
                problem: openPublishedProblemWhere(slug),
            },
            data: {
                status: "DELETED",
                bodyMarkdown: "",
                deletedAt: new Date(),
            },
        })

        if (update.count === 0) {
            return { ok: false as const, error: "Comment not deleted.", status: 409 }
        }

        const updated = await tx.discussionComment.findUniqueOrThrow({
            where: { id: commentId },
            include: publicCommentInclude(principal.userId),
        })

        return { ok: true as const, data: shapePublicComment(updated) }
    })

    if (!result.ok) {
        if (result.error !== "Comment not deleted.") {
            return NextResponse.json(
                { error: result.error },
                { status: result.status }
            )
        }
        const comment = await findOwnedComment(slug, commentId, principal.userId)
        if (!comment) {
            return NextResponse.json({ error: "Comment not found." }, { status: 404 })
        }
        if ((comment.problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
            return NextResponse.json(
                { error: "Discussion is not open." },
                { status: 403 }
            )
        }
        if (comment.status === "DELETED") {
            const deleted = await prisma.discussionComment.findUniqueOrThrow({
                where: { id: comment.id },
                include: publicCommentInclude(principal.userId),
            })
            return NextResponse.json({ data: shapePublicComment(deleted) })
        }
        return NextResponse.json(
            { error: "Only visible comments can be deleted." },
            { status: 409 }
        )
    }

    return NextResponse.json({ data: result.data })
})
