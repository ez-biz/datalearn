import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { DiscussionReportInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Ctx = { params: Promise<{ slug: string; commentId: string }> }

async function readJson(req: Request): Promise<unknown | null> {
    try {
        return await req.json()
    } catch {
        return null
    }
}

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
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

    const parsed = DiscussionReportInput.safeParse(await readJson(req))
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const comment = await prisma.discussionComment.findFirst({
        where: {
            id: commentId,
            problem: { slug, status: "PUBLISHED" },
            status: { in: ["VISIBLE", "DELETED"] },
        },
        select: {
            id: true,
            userId: true,
            problem: {
                select: {
                    discussionState: { select: { mode: true } },
                },
            },
        },
    })

    if (!comment) {
        return NextResponse.json({ error: "Comment not found." }, { status: 404 })
    }

    if (comment.userId === principal.userId) {
        return NextResponse.json(
            { error: "You cannot report your own comment." },
            { status: 403 }
        )
    }

    if ((comment.problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
        return NextResponse.json(
            { error: "Discussion is not open." },
            { status: 403 }
        )
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const report = await tx.discussionReport.create({
                data: {
                    commentId: comment.id,
                    userId: principal.userId,
                    reason: parsed.data.reason,
                    message: parsed.data.message.trim(),
                },
            })
            const reportCount = await tx.discussionReport.count({
                where: {
                    commentId: comment.id,
                    status: "OPEN",
                },
            })
            await tx.discussionComment.update({
                where: { id: comment.id },
                data: { reportCount },
            })

            return { report, reportCount }
        })

        return NextResponse.json({ data: result }, { status: 201 })
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return NextResponse.json(
                { error: "You already reported this comment." },
                { status: 409 }
            )
        }

        throw error
    }
})
