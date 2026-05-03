"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { ReactNode } from "react"
import {
    Ban,
    CheckCircle2,
    EyeOff,
    Loader2,
    RotateCcw,
} from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer"

type TabKey = "needsReview" | "hidden" | "dismissedReports" | "spam"
type ActionKey = "hide" | "restore" | "dismiss-reports" | "mark-spam"

type QueueItem = {
    id: string
    bodyMarkdown: string
    status: "VISIBLE" | "HIDDEN" | "DELETED" | "SPAM"
    score: number
    reportCount: number
    createdAt: string
    updatedAt: string
    hiddenAt: string | null
    problem: {
        slug: string
        title: string
        number: number
    }
    author: {
        id: string
        name: string | null
        email: string | null
    } | null
    latestReport: {
        id: string
        reason: string
        message: string
        status: string
        createdAt: string
        reporter: string
    } | null
}

type Permissions = {
    hideComment: boolean
    restoreComment: boolean
    dismissReport: boolean
    markSpam: boolean
}

const TABS: Array<{ key: TabKey; label: string }> = [
    { key: "needsReview", label: "Needs review" },
    { key: "hidden", label: "Hidden" },
    { key: "dismissedReports", label: "Dismissed" },
    { key: "spam", label: "Spam" },
]

const REPORT_LABELS: Record<string, string> = {
    SPAM: "Spam",
    ABUSE: "Abuse",
    SPOILER: "Spoiler",
    OFF_TOPIC: "Off topic",
    OTHER: "Other",
}

export function DiscussionQueueClient({
    queues,
    permissions,
}: {
    queues: Record<TabKey, QueueItem[]>
    permissions: Permissions
}) {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<TabKey>("needsReview")
    const [pending, setPending] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const activeRows = queues[activeTab]

    async function runAction(comment: QueueItem, action: ActionKey) {
        if (
            action === "mark-spam" &&
            !confirm("Mark this discussion comment as spam?")
        ) {
            return
        }

        setError(null)
        setPending(`${comment.id}:${action}`)
        try {
            const res = await fetch(
                `/api/admin/discussions/${comment.id}/${action}`,
                { method: "POST" }
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Moderation action failed.")
                return
            }
            router.refresh()
        } finally {
            setPending(null)
        }
    }

    return (
        <div className="space-y-4">
            <div
                role="tablist"
                aria-label="Discussion moderation queues"
                className="flex gap-2 overflow-x-auto border-b border-border"
            >
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={
                            activeTab === tab.key
                                ? "h-10 shrink-0 border-b-2 border-primary px-3 text-sm font-medium text-foreground"
                                : "h-10 shrink-0 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        }
                    >
                        {tab.label}{" "}
                        <span className="tabular-nums">
                            {queues[tab.key].length}
                        </span>
                    </button>
                ))}
            </div>

            {error && (
                <div
                    role="alert"
                    className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                >
                    {error}
                </div>
            )}

            {activeRows.length === 0 ? (
                <div className="rounded-md border border-border bg-surface px-5 py-8 text-center">
                    <p className="text-sm font-medium">No comments in this queue.</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Choose another tab or wait for new reports.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeRows.map((comment) => (
                        <QueueRow
                            key={comment.id}
                            comment={comment}
                            permissions={permissions}
                            pending={pending}
                            onAction={runAction}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}

function QueueRow({
    comment,
    permissions,
    pending,
    onAction,
}: {
    comment: QueueItem
    permissions: Permissions
    pending: string | null
    onAction: (comment: QueueItem, action: ActionKey) => void
}) {
    const author =
        comment.author?.name ?? comment.author?.email ?? "Deleted account"
    const canHide = permissions.hideComment && comment.status === "VISIBLE"
    const canRestore =
        permissions.restoreComment &&
        (comment.status === "HIDDEN" || comment.status === "SPAM")
    const canDismiss = permissions.dismissReport && comment.status !== "SPAM"
    const canMarkSpam = permissions.markSpam && comment.status !== "SPAM"

    return (
        <Card className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge
                            variant={
                                comment.status === "VISIBLE"
                                    ? "primary"
                                    : comment.status === "SPAM"
                                      ? "secondary"
                                      : "outline"
                            }
                        >
                            {comment.status.toLowerCase()}
                        </Badge>
                        <Link
                            href={`/practice/${comment.problem.slug}`}
                            className="truncate text-sm font-medium hover:text-primary"
                        >
                            {comment.problem.number}. {comment.problem.title}
                        </Link>
                        <Link
                            href={`/admin/problems/${comment.problem.slug}/edit`}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            edit
                        </Link>
                    </div>

                    <div className="max-h-40 overflow-hidden rounded-md border border-border bg-surface-muted/40 px-3 py-2">
                        <MarkdownRenderer content={comment.bodyMarkdown} />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                            by {author}
                            {comment.author?.email &&
                                comment.author.name &&
                                ` (${comment.author.email})`}
                        </span>
                        <span>
                            score{" "}
                            <span className="tabular-nums text-foreground">
                                {comment.score}
                            </span>
                        </span>
                        <span>
                            reports{" "}
                            <span className="tabular-nums text-foreground">
                                {comment.reportCount}
                            </span>
                        </span>
                        <span>updated {fmt(comment.updatedAt)}</span>
                    </div>

                    {comment.latestReport && (
                        <div className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">
                                    {REPORT_LABELS[comment.latestReport.reason] ??
                                        comment.latestReport.reason}
                                </Badge>
                                <span className="text-muted-foreground">
                                    {comment.latestReport.status.toLowerCase()} ·{" "}
                                    {comment.latestReport.reporter} ·{" "}
                                    {fmt(comment.latestReport.createdAt)}
                                </span>
                            </div>
                            {comment.latestReport.message && (
                                <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                                    {comment.latestReport.message}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                {(canHide || canRestore || canDismiss || canMarkSpam) && (
                    <div className="flex flex-wrap gap-2 lg:w-44 lg:flex-col">
                        {canHide && (
                            <ActionButton
                                label="Hide"
                                icon={<EyeOff className="h-3.5 w-3.5" />}
                                pending={pending === `${comment.id}:hide`}
                                onClick={() => onAction(comment, "hide")}
                            />
                        )}
                        {canRestore && (
                            <ActionButton
                                label="Restore"
                                icon={<RotateCcw className="h-3.5 w-3.5" />}
                                pending={pending === `${comment.id}:restore`}
                                onClick={() => onAction(comment, "restore")}
                            />
                        )}
                        {canDismiss && (
                            <ActionButton
                                label="Dismiss reports"
                                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                                pending={
                                    pending ===
                                    `${comment.id}:dismiss-reports`
                                }
                                onClick={() =>
                                    onAction(comment, "dismiss-reports")
                                }
                            />
                        )}
                        {canMarkSpam && (
                            <ActionButton
                                label="Mark spam"
                                icon={<Ban className="h-3.5 w-3.5" />}
                                pending={pending === `${comment.id}:mark-spam`}
                                onClick={() => onAction(comment, "mark-spam")}
                                destructive
                            />
                        )}
                    </div>
                )}
            </div>
        </Card>
    )
}

function ActionButton({
    label,
    icon,
    pending,
    onClick,
    destructive = false,
}: {
    label: string
    icon: ReactNode
    pending: boolean
    onClick: () => void
    destructive?: boolean
}) {
    return (
        <Button
            type="button"
            variant={destructive ? "destructive" : "outline"}
            size="sm"
            className="min-h-10 justify-start"
            onClick={onClick}
            disabled={pending}
        >
            {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
                icon
            )}
            {label}
        </Button>
    )
}

function fmt(value: string): string {
    const t = new Date(value)
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
