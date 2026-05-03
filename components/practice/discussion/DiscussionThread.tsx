"use client"

import { MessagesSquare } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import { DiscussionComment } from "./DiscussionComment"
import type { PublicDiscussionComment } from "./DiscussionPanel"

interface DiscussionThreadProps {
    comments: PublicDiscussionComment[]
    problemSlug: string
    isSignedIn: boolean
    viewerUserId: string | null
    mode: "OPEN" | "LOCKED" | "HIDDEN"
    onReply: (parentId: string, bodyMarkdown: string) => Promise<void>
    onUpdate: (comment: PublicDiscussionComment) => void
}

export function DiscussionThread({
    comments,
    problemSlug,
    isSignedIn,
    viewerUserId,
    mode,
    onReply,
    onUpdate,
}: DiscussionThreadProps) {
    if (comments.length === 0) {
        return (
            <EmptyState
                icon={<MessagesSquare className="h-5 w-5" />}
                title={mode === "LOCKED" ? "No comments yet" : "No discussion yet"}
                description={
                    mode === "LOCKED"
                        ? "This discussion is locked, so no new comments can be added."
                        : "Start with a question, edge case, or a short explanation of your approach."
                }
            />
        )
    }

    return (
        <div className="space-y-3">
            {comments.map((comment) => (
                <DiscussionComment
                    key={comment.id}
                    comment={comment}
                    problemSlug={problemSlug}
                    isSignedIn={isSignedIn}
                    viewerUserId={viewerUserId}
                    mode={mode}
                    onReply={onReply}
                    onUpdate={onUpdate}
                />
            ))}
        </div>
    )
}
