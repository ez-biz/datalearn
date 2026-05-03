import { prisma } from "@/lib/prisma"
import type { DiscussionSettings, Prisma } from "@prisma/client"
import type { ReputationTier } from "./constants"

type DiscussionLimitAction = "COMMENT" | "REPLY" | "VOTE"

type DiscussionLimitResult = { ok: true } | { ok: false; error: string }

type TierLimits = {
    topLevelPerHour: number
    repliesPerHour: number
    perProblemPerDay: number
    minSecondsBetween: number
    votesPerHour: number
}

type VoteLimitClient = Pick<Prisma.TransactionClient, "discussionVoteAction">
type DiscussionLimitClient = Pick<
    Prisma.TransactionClient,
    "discussionComment" | "discussionVoteAction"
>

function tierLimits(
    settings: DiscussionSettings,
    tier: ReputationTier
): TierLimits {
    if (tier === "HIGH_TRUST") {
        return {
            topLevelPerHour: settings.highTopLevelPerHour,
            repliesPerHour: settings.highRepliesPerHour,
            perProblemPerDay: settings.highPerProblemPerDay,
            minSecondsBetween: settings.highMinSecondsBetween,
            votesPerHour: settings.highVotesPerHour,
        }
    }

    if (tier === "TRUSTED") {
        return {
            topLevelPerHour: settings.trustedTopLevelPerHour,
            repliesPerHour: settings.trustedRepliesPerHour,
            perProblemPerDay: settings.trustedPerProblemPerDay,
            minSecondsBetween: settings.trustedMinSecondsBetween,
            votesPerHour: settings.trustedVotesPerHour,
        }
    }

    return {
        topLevelPerHour: settings.newTopLevelPerHour,
        repliesPerHour: settings.newRepliesPerHour,
        perProblemPerDay: settings.newPerProblemPerDay,
        minSecondsBetween: settings.newMinSecondsBetween,
        votesPerHour: settings.newVotesPerHour,
    }
}

export async function checkVoteLimit(input: {
    userId: string
    tier: ReputationTier
    settings: DiscussionSettings
    client?: VoteLimitClient
}): Promise<DiscussionLimitResult> {
    const limits = tierLimits(input.settings, input.tier)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const client = input.client ?? prisma
    const votes = await client.discussionVoteAction.count({
        where: {
            userId: input.userId,
            createdAt: { gte: oneHourAgo },
        },
    })

    if (votes >= limits.votesPerHour) {
        return { ok: false, error: "Too many votes. Try again later." }
    }

    return { ok: true }
}

export async function checkDiscussionLimit(input: {
    userId: string
    problemId: string
    bodyMarkdown?: string
    action: DiscussionLimitAction
    tier: ReputationTier
    settings: DiscussionSettings
    client?: DiscussionLimitClient
}): Promise<DiscussionLimitResult> {
    const now = Date.now()
    const oneHourAgo = new Date(now - 60 * 60 * 1000)
    const client = input.client ?? prisma

    if (input.action === "VOTE") {
        return checkVoteLimit({ ...input, client })
    }

    const limits = tierLimits(input.settings, input.tier)
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000)
    const hourlyLimit =
        input.action === "REPLY"
            ? limits.repliesPerHour
            : limits.topLevelPerHour
    const parentId = input.action === "REPLY" ? { not: null } : null

    const hourlyCount = await client.discussionComment.count({
        where: {
            userId: input.userId,
            parentId,
            createdAt: { gte: oneHourAgo },
        },
    })

    if (hourlyCount >= hourlyLimit) {
        return {
            ok: false,
            error: "You are posting too quickly. Try again later.",
        }
    }

    const problemDayCount = await client.discussionComment.count({
        where: {
            userId: input.userId,
            problemId: input.problemId,
            createdAt: { gte: oneDayAgo },
        },
    })

    if (problemDayCount >= limits.perProblemPerDay) {
        return {
            ok: false,
            error: "Daily comment limit reached for this problem.",
        }
    }

    const lastComment = await client.discussionComment.findFirst({
        where: { userId: input.userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
    })

    if (
        lastComment &&
        now - lastComment.createdAt.getTime() <
            limits.minSecondsBetween * 1000
    ) {
        return { ok: false, error: "Please wait before posting again." }
    }

    const trimmedBody = input.bodyMarkdown?.trim()
    if (trimmedBody) {
        const duplicateSince = new Date(
            now - input.settings.duplicateCooldownSeconds * 1000
        )
        const duplicate = await client.discussionComment.findFirst({
            where: {
                userId: input.userId,
                problemId: input.problemId,
                bodyMarkdown: trimmedBody,
                createdAt: { gte: duplicateSince },
            },
            select: { id: true },
        })

        if (duplicate) {
            return {
                ok: false,
                error: "Duplicate comment. Edit your previous comment instead.",
            }
        }
    }

    return { ok: true }
}
