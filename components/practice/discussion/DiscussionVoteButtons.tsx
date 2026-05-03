"use client"

import { useState } from "react"
import { ArrowBigDown, ArrowBigUp } from "lucide-react"
import { cn } from "@/lib/utils"

export type DiscussionVoteValue = "UP" | "DOWN" | null

interface DiscussionVoteButtonsProps {
    problemSlug: string
    commentId: string
    upvotes: number
    downvotes: number
    score: number
    viewerVote: DiscussionVoteValue
    isSignedIn: boolean
    disabled?: boolean
    onChange: (values: {
        upvotes: number
        downvotes: number
        score: number
        viewerVote: DiscussionVoteValue
    }) => void
}

export function DiscussionVoteButtons({
    problemSlug,
    commentId,
    upvotes,
    downvotes,
    score,
    viewerVote,
    isSignedIn,
    disabled,
    onChange,
}: DiscussionVoteButtonsProps) {
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function vote(next: Exclude<DiscussionVoteValue, null>) {
        if (!isSignedIn || disabled || pending) return

        const value = viewerVote === next ? null : next
        setPending(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/problems/${problemSlug}/discussion/${commentId}/vote`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ value }),
                }
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error ?? "Vote failed.")
            }
            onChange({
                upvotes: payload.data.upvotes,
                downvotes: payload.data.downvotes,
                score: payload.data.score,
                viewerVote: payload.data.value,
            })
        } catch (err) {
            setError(err instanceof Error ? err.message : "Vote failed.")
        } finally {
            setPending(false)
        }
    }

    return (
        <div className="flex flex-col items-center gap-1 text-[11px] text-muted-foreground">
            <button
                type="button"
                aria-label={viewerVote === "UP" ? "Remove upvote" : "Upvote comment"}
                aria-pressed={viewerVote === "UP"}
                disabled={!isSignedIn || disabled || pending}
                onClick={() => vote("UP")}
                className={cn(
                    "inline-flex h-8 min-w-10 items-center justify-center gap-0.5 rounded-md border border-border px-1.5 transition-colors active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50",
                    viewerVote === "UP"
                        ? "border-easy/40 bg-easy/10 text-easy"
                        : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
                title={error ?? undefined}
            >
                <ArrowBigUp className="h-4 w-4" />
                <span className="tabular-nums">{upvotes}</span>
            </button>
            <div className="tabular-nums font-semibold text-foreground" title="Score">
                {score}
            </div>
            <button
                type="button"
                aria-label={
                    viewerVote === "DOWN" ? "Remove downvote" : "Downvote comment"
                }
                aria-pressed={viewerVote === "DOWN"}
                disabled={!isSignedIn || disabled || pending}
                onClick={() => vote("DOWN")}
                className={cn(
                    "inline-flex h-8 min-w-10 items-center justify-center gap-0.5 rounded-md border border-border px-1.5 transition-colors active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50",
                    viewerVote === "DOWN"
                        ? "border-hard/40 bg-hard/10 text-hard"
                        : "bg-surface text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                )}
                title={error ?? undefined}
            >
                <ArrowBigDown className="h-4 w-4" />
                <span className="tabular-nums">{downvotes}</span>
            </button>
        </div>
    )
}
