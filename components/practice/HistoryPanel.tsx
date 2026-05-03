"use client"

import { useState } from "react"
import { CheckCircle2, ChevronDown, ChevronRight, History, XCircle } from "lucide-react"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import type { ProblemHistoryEntry } from "@/actions/submissions"

interface HistoryPanelProps {
    history: ProblemHistoryEntry[]
    onLoadCode?: (code: string) => void
    onShareApproach?: (code: string) => void
}

export function HistoryPanel({
    history,
    onLoadCode,
    onShareApproach,
}: HistoryPanelProps) {
    const [openId, setOpenId] = useState<string | null>(null)

    if (history.length === 0) {
        return (
            <div className="p-5">
                <EmptyState
                    icon={<History className="h-5 w-5" />}
                    title="No submissions yet"
                    description="Run your query and hit Submit to record an attempt here."
                />
            </div>
        )
    }

    return (
        <div className="p-3 space-y-2">
            {history.map((s) => {
                const open = openId === s.id
                return (
                    <div
                        key={s.id}
                        className={cn(
                            "rounded-md border bg-surface",
                            s.status === "ACCEPTED"
                                ? "border-easy/30"
                                : "border-border"
                        )}
                    >
                        <button
                            type="button"
                            onClick={() => setOpenId(open ? null : s.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 text-left cursor-pointer"
                            aria-expanded={open}
                        >
                            {s.status === "ACCEPTED" ? (
                                <CheckCircle2 className="h-4 w-4 text-easy shrink-0" />
                            ) : (
                                <XCircle className="h-4 w-4 text-hard shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">
                                    {s.status === "ACCEPTED" ? "Accepted" : "Wrong answer"}
                                </div>
                                <div className="text-xs text-muted-foreground tabular-nums">
                                    {formatRelative(s.createdAt)}
                                </div>
                            </div>
                            {open ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                        </button>
                        {open && (
                            <div className="border-t border-border px-3 py-3 space-y-2.5">
                                {s.reason && s.status === "WRONG_ANSWER" && (
                                    <div className="text-xs text-muted-foreground">
                                        {s.reason}
                                    </div>
                                )}
                                {s.code ? (
                                    <>
                                        <pre className="rounded-md border border-border bg-surface-muted p-2.5 font-mono text-[12px] leading-relaxed overflow-x-auto scrollbar-thin max-h-64">
                                            <code>{s.code}</code>
                                        </pre>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                            {onLoadCode && (
                                                <button
                                                    type="button"
                                                    onClick={() => onLoadCode(s.code)}
                                                    className="text-xs font-medium text-primary transition-colors hover:text-primary-hover active:scale-[0.96] cursor-pointer"
                                                >
                                                    Load this code into editor →
                                                </button>
                                            )}
                                            {onShareApproach &&
                                                s.status === "ACCEPTED" && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            onShareApproach(s.code)
                                                        }
                                                        className="text-xs font-medium text-primary transition-colors hover:text-primary-hover active:scale-[0.96] cursor-pointer"
                                                    >
                                                        Share approach →
                                                    </button>
                                                )}
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-xs text-muted-foreground italic">
                                        Code not recorded for this submission.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}

function formatRelative(date: Date | string): string {
    const t = typeof date === "string" ? new Date(date) : date
    const diffMs = Date.now() - t.getTime()
    const sec = Math.round(diffMs / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.round(hr / 24)
    if (day < 30) return `${day}d ago`
    return t.toLocaleDateString()
}
