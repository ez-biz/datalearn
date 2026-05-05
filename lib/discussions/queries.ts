import type { Prisma } from "@prisma/client"

const PUBLIC_COMMENT_STATUSES = ["VISIBLE", "DELETED"] as const
const ANONYMOUS_VIEWER_ID = "__anonymous_viewer__"
export const BEST_RECENCY_WINDOW_SECONDS = 7 * 24 * 60 * 60

export type DiscussionSort = "best" | "votes" | "latest"

const publicCommentAuthorSelect = {
    id: true,
    name: true,
    image: true,
} satisfies Prisma.UserSelect

type PublicCommentReplyRecord = Prisma.DiscussionCommentGetPayload<{
    include: {
        user: { select: typeof publicCommentAuthorSelect }
        votes: { select: { value: true } }
        _count: { select: { replies: true } }
    }
}>

type PublicCommentRecord = Prisma.DiscussionCommentGetPayload<{
    include: {
        user: { select: typeof publicCommentAuthorSelect }
        votes: { select: { value: true } }
        replies: {
            include: {
                user: { select: typeof publicCommentAuthorSelect }
                votes: { select: { value: true } }
                _count: { select: { replies: true } }
            }
        }
        _count: { select: { replies: true } }
    }
}>

export type PublicDiscussionComment = {
    id: string
    parentId: string | null
    bodyMarkdown: string
    status: "VISIBLE" | "DELETED"
    author: {
        id: string
        name: string | null
        image: string | null
    } | null
    upvotes: number
    downvotes: number
    score: number
    replyCount: number
    viewerVote: "UP" | "DOWN" | null
    createdAt: Date
    updatedAt: Date
    editedAt: Date | null
    deletedAt: Date | null
    replies: PublicDiscussionComment[]
}

export function parseDiscussionSort(value: string | null): DiscussionSort {
    if (value === "votes" || value === "latest") return value
    return "best"
}

export function discussionOrderBy(
    sort: DiscussionSort
): Prisma.DiscussionCommentOrderByWithRelationInput[] {
    if (sort === "latest") return [{ createdAt: "desc" }]
    // Exact Best ordering adds a small recency boost in the read route,
    // because Prisma orderBy cannot express score + age decay directly.
    return [{ score: "desc" }, { createdAt: "desc" }]
}

export function publicCommentWhere(
    problemId: string
): Prisma.DiscussionCommentWhereInput {
    return {
        problemId,
        parentId: null,
        status: { in: [...PUBLIC_COMMENT_STATUSES] },
    }
}

export function publicReplyWhere(): Prisma.DiscussionCommentWhereInput {
    return {
        status: { in: [...PUBLIC_COMMENT_STATUSES] },
    }
}

export function publicCommentInclude(viewerUserId: string | null) {
    const viewerVoteWhere = { userId: viewerUserId ?? ANONYMOUS_VIEWER_ID }

    return {
        user: { select: publicCommentAuthorSelect },
        votes: {
            where: viewerVoteWhere,
            select: { value: true },
            take: 1,
        },
        replies: {
            where: publicReplyWhere(),
            orderBy: { createdAt: "asc" },
            take: 5,
            include: {
                user: { select: publicCommentAuthorSelect },
                votes: {
                    where: viewerVoteWhere,
                    select: { value: true },
                    take: 1,
                },
                _count: {
                    select: {
                        replies: {
                            where: { status: { in: [...PUBLIC_COMMENT_STATUSES] } },
                        },
                    },
                },
            },
        },
        _count: {
            select: {
                replies: {
                    where: { status: { in: [...PUBLIC_COMMENT_STATUSES] } },
                },
            },
        },
    } satisfies Prisma.DiscussionCommentInclude
}

export function shapePublicComment(
    comment: PublicCommentRecord
): PublicDiscussionComment {
    return {
        ...shapePublicCommentBase(comment),
        replies: comment.replies.map(shapePublicReply),
    }
}

export function shapePublicReply(
    comment: PublicCommentReplyRecord
): PublicDiscussionComment {
    return {
        ...shapePublicCommentBase(comment),
        replies: [],
    }
}

function shapePublicCommentBase(
    comment: PublicCommentReplyRecord
): Omit<PublicDiscussionComment, "replies"> {
    const visible = comment.status === "VISIBLE"

    return {
        id: comment.id,
        parentId: comment.parentId,
        bodyMarkdown: visible ? comment.bodyMarkdown : "",
        status: visible ? "VISIBLE" : "DELETED",
        author: visible ? comment.user : null,
        upvotes: comment.upvotes,
        downvotes: comment.downvotes,
        score: comment.score,
        replyCount: comment._count.replies,
        viewerVote: comment.votes[0]?.value ?? null,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        editedAt: comment.editedAt,
        deletedAt: comment.deletedAt,
    }
}
