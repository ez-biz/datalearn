"use client"

import { useState } from "react"
import Image from "next/image"
import {
    CornerDownRight,
    Flag,
    MessageSquareReply,
    Pencil,
    Trash2,
} from "lucide-react"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import { DiscussionComposer } from "./DiscussionComposer"
import { DiscussionVoteButtons } from "./DiscussionVoteButtons"
import type { PublicDiscussionComment } from "./DiscussionPanel"

interface DiscussionCommentProps {
    comment: PublicDiscussionComment
    problemSlug: string
    isSignedIn: boolean
    viewerUserId: string | null
    mode: "OPEN" | "LOCKED" | "HIDDEN"
    depth?: 0 | 1
    onReply: (parentId: string, bodyMarkdown: string) => Promise<void>
    onUpdate: (comment: PublicDiscussionComment) => void
}

export function DiscussionComment({
    comment,
    problemSlug,
    isSignedIn,
    viewerUserId,
    mode,
    depth = 0,
    onReply,
    onUpdate,
}: DiscussionCommentProps) {
    const [replying, setReplying] = useState(false)
    const [replyBody, setReplyBody] = useState("")
    const [editing, setEditing] = useState(false)
    const [editBody, setEditBody] = useState(comment.bodyMarkdown)
    const [pending, setPending] = useState(false)
    const [reported, setReported] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const visible = comment.status === "VISIBLE"
    const owned = Boolean(
        visible && viewerUserId && comment.author?.id === viewerUserId
    )
    const canInteract = mode === "OPEN" && visible
    const authorName = comment.author?.name || "Data Learn user"

    async function submitReply() {
        setError(null)
        try {
            await onReply(comment.id, replyBody)
            setReplyBody("")
            setReplying(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not post reply.")
        }
    }

    async function saveEdit() {
        if (!editBody.trim()) return
        setPending(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/problems/${problemSlug}/discussion/${comment.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ bodyMarkdown: editBody }),
                }
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error ?? "Could not update comment.")
            }
            onUpdate(payload.data)
            setEditing(false)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not update comment.")
        } finally {
            setPending(false)
        }
    }

    async function deleteComment() {
        setPending(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/problems/${problemSlug}/discussion/${comment.id}`,
                { method: "DELETE" }
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error ?? "Could not delete comment.")
            }
            onUpdate(payload.data)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not delete comment.")
        } finally {
            setPending(false)
        }
    }

    async function reportComment() {
        if (!isSignedIn || !canInteract || reported) return
        setPending(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/problems/${problemSlug}/discussion/${comment.id}/report`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        reason: "OTHER",
                        message: "Reported from learner discussion.",
                    }),
                }
            )
            const payload = await response.json().catch(() => null)
            if (!response.ok) {
                throw new Error(payload?.error ?? "Could not report comment.")
            }
            setReported(true)
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not report comment.")
        } finally {
            setPending(false)
        }
    }

    return (
        <article
            className={cn(
                "rounded-md border border-border bg-surface",
                depth === 1 && "bg-surface-muted/20"
            )}
        >
            <div className="flex gap-3 p-3">
                <DiscussionVoteButtons
                    problemSlug={problemSlug}
                    commentId={comment.id}
                    upvotes={comment.upvotes}
                    downvotes={comment.downvotes}
                    score={comment.score}
                    viewerVote={comment.viewerVote}
                    isSignedIn={isSignedIn}
                    disabled={!canInteract || owned}
                    onChange={(values) => onUpdate({ ...comment, ...values })}
                />
                <div className="min-w-0 flex-1">
                    <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {visible ? (
                            <>
                                <Avatar image={comment.author?.image ?? null} name={authorName} />
                                <span className="font-medium text-foreground">
                                    {authorName}
                                </span>
                            </>
                        ) : (
                            <span className="italic">Deleted comment</span>
                        )}
                        <span className="tabular-nums">
                            {formatRelative(comment.createdAt)}
                        </span>
                        {comment.editedAt && visible && <span>edited</span>}
                    </header>

                    <div className="mt-2">
                        {!visible ? (
                            <p className="text-sm italic text-muted-foreground">
                                This comment was deleted.
                            </p>
                        ) : editing ? (
                            <DiscussionComposer
                                value={editBody}
                                onChange={setEditBody}
                                onSubmit={saveEdit}
                                disabled={pending}
                                isSignedIn={isSignedIn}
                                submitLabel="Save"
                                compact
                            />
                        ) : (
                            <MarkdownRenderer content={comment.bodyMarkdown} />
                        )}
                    </div>

                    {error && (
                        <p className="mt-2 text-xs text-hard" role="alert">
                            {error}
                        </p>
                    )}

                    {visible && (
                        <footer className="mt-3 flex flex-wrap items-center gap-1.5">
                            {depth === 0 && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    disabled={mode !== "OPEN"}
                                    onClick={() => setReplying((open) => !open)}
                                    className="h-8 px-2"
                                >
                                    <MessageSquareReply className="h-3.5 w-3.5" />
                                    Reply
                                </Button>
                            )}
                            {owned && (
                                <>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={pending}
                                        onClick={() => {
                                            setEditBody(comment.bodyMarkdown)
                                            setEditing((open) => !open)
                                        }}
                                        className="h-8 px-2"
                                    >
                                        <Pencil className="h-3.5 w-3.5" />
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={pending}
                                        onClick={deleteComment}
                                        className="h-8 px-2 text-hard hover:text-hard"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Delete
                                    </Button>
                                </>
                            )}
                            {!owned &&
                                (isSignedIn ? (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        disabled={pending || reported || !canInteract}
                                        onClick={reportComment}
                                        className="h-8 px-2"
                                    >
                                        <Flag className="h-3.5 w-3.5" />
                                        {reported ? "Reported" : "Report"}
                                    </Button>
                                ) : (
                                    <SignInDialogButton className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground active:scale-[0.96]">
                                        <Flag className="h-3.5 w-3.5" />
                                        Report
                                    </SignInDialogButton>
                                ))}
                        </footer>
                    )}

                    {replying && depth === 0 && (
                        <div className="mt-3">
                            <DiscussionComposer
                                value={replyBody}
                                onChange={setReplyBody}
                                onSubmit={submitReply}
                                disabled={mode !== "OPEN"}
                                isSignedIn={isSignedIn}
                                placeholder="Reply to this thread."
                                submitLabel="Reply"
                                compact
                            />
                        </div>
                    )}

                    {depth === 0 && comment.replies.length > 0 && (
                        <div className="mt-3 space-y-2 border-l border-border pl-3">
                            {comment.replies.map((reply) => (
                                <div key={reply.id} className="relative">
                                    <CornerDownRight className="absolute -left-5 top-3 h-3.5 w-3.5 text-muted-foreground" />
                                    <DiscussionComment
                                        comment={reply}
                                        problemSlug={problemSlug}
                                        isSignedIn={isSignedIn}
                                        viewerUserId={viewerUserId}
                                        mode={mode}
                                        depth={1}
                                        onReply={onReply}
                                        onUpdate={onUpdate}
                                    />
                                </div>
                            ))}
                            {comment.replyCount > comment.replies.length && (
                                <p className="px-1 text-[11px] text-muted-foreground tabular-nums">
                                    Showing {comment.replies.length} of{" "}
                                    {comment.replyCount} replies.
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </article>
    )
}

function Avatar({ image, name }: { image: string | null; name: string }) {
    if (image) {
        return (
            <Image
                src={image}
                alt=""
                width={20}
                height={20}
                className="h-5 w-5 rounded-full border border-border"
            />
        )
    }

    return (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-muted text-[10px] font-semibold text-muted-foreground">
            {name.slice(0, 1).toUpperCase()}
        </span>
    )
}

function formatRelative(date: string): string {
    const t = new Date(date)
    const diffMs = Date.now() - t.getTime()
    const sec = Math.max(0, Math.round(diffMs / 1000))
    if (sec < 60) return `${sec}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.round(hr / 24)
    if (day < 30) return `${day}d ago`
    return t.toLocaleDateString()
}
