import type { DiscussionVoteValue } from "@prisma/client"

export const VOTE_CHURN_COOLDOWN_SECONDS = 5

export type VoteCounterDelta = {
    upvotes: number
    downvotes: number
    score: number
}

export function voteCounterDelta(
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
