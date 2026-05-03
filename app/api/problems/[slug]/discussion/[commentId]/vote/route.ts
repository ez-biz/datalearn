import { NextResponse } from "next/server"
import { z } from "zod"
import type {
    DiscussionVoteValue,
    Prisma,
} from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { DiscussionVoteInput } from "@/lib/admin-validation"
import { withDiscussionAuth } from "@/lib/discussions/api-auth"
import { checkDiscussionLimit } from "@/lib/discussions/rate-limit"
import { getUserReputation } from "@/lib/discussions/reputation"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Ctx = { params: Promise<{ slug: string; commentId: string }> }

const VOTE_CHURN_COOLDOWN_SECONDS = 5

type VoteCounterDelta = {
    upvotes: number
    downvotes: number
    score: number
}

async function readJson(req: Request): Promise<unknown | null> {
    try {
        return await req.json()
    } catch {
        return null
    }
}

function voteCounterDelta(
    previous: DiscussionVoteValue | null,
    next: DiscussionVoteValue | null
): VoteCounterDelta {
    if (previous === next) return { upvotes: 0, downvotes: 0, score: 0 }
    if (previous === null && next === "UP") {
        return { upvotes: 1, downvotes: 0, score: 1 }
    }
    if (previous === null && next === "DOWN") {
        return { upvotes: 0, downvotes: 1, score: -1 }
    }
    if (previous === "UP" && next === null) {
        return { upvotes: -1, downvotes: 0, score: -1 }
    }
    if (previous === "DOWN" && next === null) {
        return { upvotes: 0, downvotes: -1, score: 1 }
    }
    if (previous === "UP" && next === "DOWN") {
        return { upvotes: -1, downvotes: 1, score: -2 }
    }
    if (previous === "DOWN" && next === "UP") {
        return { upvotes: 1, downvotes: -1, score: 2 }
    }

    return { upvotes: 0, downvotes: 0, score: 0 }
}

async function syncVoteReputation(input: {
    authorId: string
    commentId: string
    voterId: string
    value: DiscussionVoteValue | null
    tx: Prisma.TransactionClient
}) {
    const prefix = `vote:${input.commentId}:${input.voterId}`
    const upSourceId = `${prefix}:up-current`
    const downSourceId = `${prefix}:down-current`

    await input.tx.userReputationEvent.deleteMany({
        where: {
            userId: input.authorId,
            sourceId: {
                startsWith: `${prefix}:`,
                notIn: [upSourceId, downSourceId],
            },
        },
    })

    await input.tx.userReputationEvent.upsert({
        where: {
            userId_kind_sourceId: {
                userId: input.authorId,
                kind: "COMMENT_UPVOTE_RECEIVED",
                sourceId: upSourceId,
            },
        },
        create: {
            userId: input.authorId,
            kind: "COMMENT_UPVOTE_RECEIVED",
            sourceId: upSourceId,
            points: input.value === "UP" ? 1 : 0,
        },
        update: {
            points: input.value === "UP" ? 1 : 0,
        },
    })

    await input.tx.userReputationEvent.upsert({
        where: {
            userId_kind_sourceId: {
                userId: input.authorId,
                kind: "COMMENT_DOWNVOTE_RECEIVED",
                sourceId: downSourceId,
            },
        },
        create: {
            userId: input.authorId,
            kind: "COMMENT_DOWNVOTE_RECEIVED",
            sourceId: downSourceId,
            points: input.value === "DOWN" ? -1 : 0,
        },
        update: {
            points: input.value === "DOWN" ? -1 : 0,
        },
    })
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
            status: "VISIBLE",
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
    const currentVote = await prisma.discussionVote.findUnique({
        where: {
            commentId_userId: {
                commentId: comment.id,
                userId: principal.userId,
            },
        },
        select: { updatedAt: true },
    })

    // The schema stores only current votes, so removing a vote deletes the
    // hourly evidence. Until a dedicated vote-action table exists, combine the
    // current-row hourly cap with a short same-comment churn guard.
    if (
        currentVote &&
        Date.now() - currentVote.updatedAt.getTime() <
            VOTE_CHURN_COOLDOWN_SECONDS * 1000
    ) {
        return NextResponse.json(
            { error: "You are voting too quickly. Try again shortly." },
            { status: 429 }
        )
    }

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
        const delta = voteCounterDelta(previousValue, value)

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

        const updated =
            delta.upvotes === 0 && delta.downvotes === 0 && delta.score === 0
                ? await tx.discussionComment.findUniqueOrThrow({
                      where: { id: comment.id },
                      select: {
                          upvotes: true,
                          downvotes: true,
                          score: true,
                      },
                  })
                : await tx.discussionComment.update({
                      where: { id: comment.id },
                      data: {
                          upvotes: { increment: delta.upvotes },
                          downvotes: { increment: delta.downvotes },
                          score: { increment: delta.score },
                      },
                      select: {
                          upvotes: true,
                          downvotes: true,
                          score: true,
                      },
                  })

        if (comment.userId) {
            await syncVoteReputation({
                authorId: comment.userId,
                commentId: comment.id,
                voterId: principal.userId,
                value,
                tx,
            })
        }

        return {
            value,
            upvotes: updated.upvotes,
            downvotes: updated.downvotes,
            score: updated.score,
        }
    })

    return NextResponse.json({ data: result })
})
