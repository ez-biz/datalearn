import { NextResponse } from "next/server"
import { z } from "zod"
import type {
    DiscussionVoteValue,
    Prisma,
    UserReputationEventKind,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { DiscussionVoteInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import { checkDiscussionLimit } from "@/lib/discussions/rate-limit"
import { getUserReputation } from "@/lib/discussions/reputation"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Ctx = { params: Promise<{ slug: string; commentId: string }> }

type ReputationDelta = {
    kind: UserReputationEventKind
    points: number
    sourceId: string
}

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

function reputationDeltas(
    commentId: string,
    voterId: string,
    previous: DiscussionVoteValue | null,
    next: DiscussionVoteValue | null
): ReputationDelta[] {
    if (previous === next) return []

    const prefix = `vote:${commentId}:${voterId}`
    if (previous === null && next === "UP") {
        return [
            {
                kind: "COMMENT_UPVOTE_RECEIVED",
                points: 1,
                sourceId: `${prefix}:up`,
            },
        ]
    }
    if (previous === null && next === "DOWN") {
        return [
            {
                kind: "COMMENT_DOWNVOTE_RECEIVED",
                points: -1,
                sourceId: `${prefix}:down`,
            },
        ]
    }
    if (previous === "UP" && next === null) {
        return [
            {
                kind: "COMMENT_UPVOTE_RECEIVED",
                points: -1,
                sourceId: `${prefix}:up:removed`,
            },
        ]
    }
    if (previous === "DOWN" && next === null) {
        return [
            {
                kind: "COMMENT_DOWNVOTE_RECEIVED",
                points: 1,
                sourceId: `${prefix}:down:removed`,
            },
        ]
    }
    if (previous === "UP" && next === "DOWN") {
        return [
            {
                kind: "COMMENT_UPVOTE_RECEIVED",
                points: -1,
                sourceId: `${prefix}:up:switched-to-down`,
            },
            {
                kind: "COMMENT_DOWNVOTE_RECEIVED",
                points: -1,
                sourceId: `${prefix}:down:switched-from-up`,
            },
        ]
    }
    if (previous === "DOWN" && next === "UP") {
        return [
            {
                kind: "COMMENT_DOWNVOTE_RECEIVED",
                points: 1,
                sourceId: `${prefix}:down:switched-to-up`,
            },
            {
                kind: "COMMENT_UPVOTE_RECEIVED",
                points: 1,
                sourceId: `${prefix}:up:switched-from-down`,
            },
        ]
    }

    return []
}

async function createReputationEvent(input: {
    userId: string
    delta: ReputationDelta
    tx: Prisma.TransactionClient
}) {
    try {
        await input.tx.userReputationEvent.create({
            data: {
                userId: input.userId,
                kind: input.delta.kind,
                points: input.delta.points,
                sourceId: input.delta.sourceId,
            },
        })
    } catch (error) {
        if (!isPrismaCode(error, "P2002")) throw error
    }
}

export const PUT = withDiscussionAuth(async (req, principal, ctx: Ctx) => {
    const { slug, commentId } = await ctx.params
    const settings = await getDiscussionSettings()

    if (!settings.globalEnabled) {
        return NextResponse.json(
            { error: "Discussions are disabled." },
            { status: 403 }
        )
    }

    const parsed = DiscussionVoteInput.safeParse(await readJson(req))
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
            problemId: true,
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

    if ((comment.problem.discussionState?.mode ?? "OPEN") !== "OPEN") {
        return NextResponse.json(
            { error: "Discussion is not open." },
            { status: 403 }
        )
    }

    if (comment.userId === principal.userId) {
        return NextResponse.json(
            { error: "You cannot vote on your own comment." },
            { status: 403 }
        )
    }

    const value = parsed.data.value
    if (value !== null) {
        const reputation = await getUserReputation(principal.userId, settings)
        const limit = await checkDiscussionLimit({
            userId: principal.userId,
            problemId: comment.problemId,
            action: "VOTE",
            tier: reputation.tier,
            settings,
        })

        if (!limit.ok) {
            return NextResponse.json({ error: limit.error }, { status: 429 })
        }
    }

    const result = await prisma.$transaction(async (tx) => {
        const previousVote = await tx.discussionVote.findUnique({
            where: {
                commentId_userId: {
                    commentId: comment.id,
                    userId: principal.userId,
                },
            },
            select: { value: true },
        })
        const previousValue = previousVote?.value ?? null

        if (value === null) {
            if (previousVote) {
                await tx.discussionVote.delete({
                    where: {
                        commentId_userId: {
                            commentId: comment.id,
                            userId: principal.userId,
                        },
                    },
                })
            }
        } else {
            await tx.discussionVote.upsert({
                where: {
                    commentId_userId: {
                        commentId: comment.id,
                        userId: principal.userId,
                    },
                },
                create: {
                    commentId: comment.id,
                    userId: principal.userId,
                    value,
                },
                update: { value },
            })
        }

        const voteCounts = await tx.discussionVote.groupBy({
            by: ["value"],
            where: { commentId: comment.id },
            _count: { value: true },
        })
        const upvotes =
            voteCounts.find((row) => row.value === "UP")?._count.value ?? 0
        const downvotes =
            voteCounts.find((row) => row.value === "DOWN")?._count.value ?? 0
        const score = upvotes - downvotes

        await tx.discussionComment.update({
            where: { id: comment.id },
            data: { upvotes, downvotes, score },
        })

        if (comment.userId) {
            for (const delta of reputationDeltas(
                comment.id,
                principal.userId,
                previousValue,
                value
            )) {
                await createReputationEvent({
                    userId: comment.userId,
                    delta,
                    tx,
                })
            }
        }

        return { value, upvotes, downvotes, score }
    })

    return NextResponse.json({ data: result })
})
