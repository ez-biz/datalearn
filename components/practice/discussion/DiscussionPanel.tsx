"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Lock, Loader2, MessageSquareOff } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionSortSelect } from "./DiscussionSortSelect"
import { DiscussionThread } from "./DiscussionThread"

export type DiscussionSort = "best" | "votes" | "latest"
export type DiscussionMode = "OPEN" | "LOCKED" | "HIDDEN"

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
    createdAt: string
    updatedAt: string
    editedAt: string | null
    deletedAt: string | null
    replies: PublicDiscussionComment[]
}

interface DiscussionPanelProps {
    problemSlug: string
    isSignedIn: boolean
    viewerUserId: string | null
    discussionMode: DiscussionMode
    discussionEnabled: boolean
    prefillMarkdown: string | null
    onPrefillConsumed: () => void
}

type DiscussionPayload = {
    data?: {
        enabled: boolean
        mode: DiscussionMode
        sort?: DiscussionSort
        page?: number
        pageSize?: number
        total: number
        comments: PublicDiscussionComment[]
    }
    error?: string
}

export function DiscussionPanel({
    problemSlug,
    isSignedIn,
    viewerUserId,
    discussionMode,
    discussionEnabled,
    prefillMarkdown,
    onPrefillConsumed,
}: DiscussionPanelProps) {
    const [sort, setSort] = useState<DiscussionSort>("best")
    const [page, setPage] = useState(1)
    const [comments, setComments] = useState<PublicDiscussionComment[]>([])
    const [total, setTotal] = useState(0)
    const [pageSize, setPageSize] = useState(20)
    const [remoteState, setRemoteState] = useState<{
        enabled: boolean
        mode: DiscussionMode
    } | null>(null)
    const [loading, setLoading] = useState(true)
    const [posting, setPosting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [composerValue, setComposerValue] = useState(prefillMarkdown ?? "")
    const enabled = remoteState?.enabled ?? discussionEnabled
    const mode = remoteState?.mode ?? discussionMode
    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
        [total, pageSize]
    )

    const loadDiscussion = useCallback(
        async (nextPage = page, nextSort = sort) => {
            setLoading(true)
            setError(null)
            try {
                const response = await fetch(
                    `/api/problems/${problemSlug}/discussion?sort=${nextSort}&page=${nextPage}`,
                    { cache: "no-store" }
                )
                const payload = (await response
                    .json()
                    .catch(() => null)) as DiscussionPayload | null
                if (!response.ok) {
                    throw new Error(payload?.error ?? "Could not load discussion.")
                }
                const data = payload?.data
                if (!data) throw new Error("Could not load discussion.")
                setRemoteState({ enabled: data.enabled, mode: data.mode })
                setComments(data.comments)
                setTotal(data.total)
                setPage(data.page ?? nextPage)
                setPageSize(data.pageSize ?? 20)
            } catch (err) {
                setError(err instanceof Error ? err.message : "Could not load discussion.")
            } finally {
                setLoading(false)
            }
        },
        [page, problemSlug, sort]
    )

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadDiscussion(page, sort)
    }, [loadDiscussion, page, sort])

    useEffect(() => {
        if (prefillMarkdown === null) return
        onPrefillConsumed()
    }, [onPrefillConsumed, prefillMarkdown])

    async function createComment() {
        if (!composerValue.trim()) return
        setPosting(true)
        setError(null)
        try {
            const response = await fetch(`/api/problems/${problemSlug}/discussion`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bodyMarkdown: composerValue }),
            })
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error ?? "Could not post comment.")
            }
            setComposerValue("")
            if (page === 1) {
                await loadDiscussion(1, sort)
            } else {
                setPage(1)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not post comment.")
        } finally {
            setPosting(false)
        }
    }

    async function createReply(parentId: string, bodyMarkdown: string) {
        if (!bodyMarkdown.trim()) return
        const response = await fetch(
            `/api/problems/${problemSlug}/discussion/${parentId}/replies`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ bodyMarkdown }),
            }
        )
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
            throw new Error(payload?.error ?? "Could not post reply.")
        }
        updateComment(payload.data)
    }

    function updateComment(updated: PublicDiscussionComment) {
        setComments((current) =>
            current.map((comment) => {
                if (comment.id === updated.id) return { ...comment, ...updated }
                if (updated.parentId === comment.id) {
                    const existing = comment.replies.some(
                        (reply) => reply.id === updated.id
                    )
                    return {
                        ...comment,
                        replyCount: existing
                            ? comment.replyCount
                            : comment.replyCount + 1,
                        replies: existing
                            ? comment.replies.map((reply) =>
                                  reply.id === updated.id
                                      ? { ...reply, ...updated }
                                      : reply
                              )
                            : [...comment.replies, updated],
                    }
                }
                return {
                    ...comment,
                    replies: comment.replies.map((reply) =>
                        reply.id === updated.id ? { ...reply, ...updated } : reply
                    ),
                }
            })
        )
    }

    const locked = mode === "LOCKED"
    const disabled = !enabled || mode === "HIDDEN"
    const composerDisabled = disabled || locked || posting

    return (
        <div className="p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold">Discussion</h2>
                    <p className="text-xs text-muted-foreground tabular-nums">
                        {total} {total === 1 ? "thread" : "threads"}
                    </p>
                </div>
                <DiscussionSortSelect
                    value={sort}
                    onChange={(value) => {
                        setSort(value)
                        setPage(1)
                    }}
                    disabled={loading || disabled}
                />
            </div>

            {!enabled && (
                <EmptyState
                    icon={<MessageSquareOff className="h-5 w-5" />}
                    title="Discussions are disabled"
                    description="This problem is not accepting discussion right now."
                />
            )}

            {enabled && mode === "HIDDEN" && (
                <EmptyState
                    icon={<MessageSquareOff className="h-5 w-5" />}
                    title="Discussion hidden"
                    description="This problem discussion is currently unavailable."
                />
            )}

            {enabled && locked && (
                <div className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                    <Lock className="h-3.5 w-3.5" />
                    This discussion is locked. Existing comments remain visible.
                </div>
            )}

            {enabled && mode !== "HIDDEN" && (
                <DiscussionComposer
                    value={composerValue}
                    onChange={setComposerValue}
                    onSubmit={createComment}
                    disabled={composerDisabled}
                    isSignedIn={isSignedIn}
                    placeholder={
                        locked
                            ? "This discussion is locked."
                            : "Share your approach, edge case, or question."
                    }
                />
            )}

            {error && (
                <div
                    role="alert"
                    className="rounded-md border border-hard/30 bg-hard/5 px-3 py-2 text-xs text-hard"
                >
                    {error}
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-md border border-border bg-surface py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading discussion...
                </div>
            ) : enabled && mode !== "HIDDEN" ? (
                <>
                    <DiscussionThread
                        comments={comments}
                        problemSlug={problemSlug}
                        isSignedIn={isSignedIn}
                        viewerUserId={viewerUserId}
                        mode={mode}
                        onReply={createReply}
                        onUpdate={updateComment}
                    />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        total={total}
                        pageSize={pageSize}
                        disabled={loading}
                        onPageChange={setPage}
                    />
                </>
            ) : null}
        </div>
    )
}

function Pagination({
    page,
    totalPages,
    total,
    pageSize,
    disabled,
    onPageChange,
}: {
    page: number
    totalPages: number
    total: number
    pageSize: number
    disabled: boolean
    onPageChange: (page: number) => void
}) {
    if (total <= pageSize) return null

    return (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <span className="text-xs text-muted-foreground tabular-nums">
                Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || page <= 1}
                    onClick={() => onPageChange(Math.max(1, page - 1))}
                >
                    Previous
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || page >= totalPages}
                    onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                >
                    Next
                </Button>
            </div>
        </div>
    )
}
