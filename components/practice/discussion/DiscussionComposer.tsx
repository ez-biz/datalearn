"use client"

import { useState } from "react"
import { Eye, PencilLine, Send } from "lucide-react"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface DiscussionComposerProps {
    value: string
    onChange: (value: string) => void
    onSubmit: () => void | Promise<void>
    disabled?: boolean
    isSignedIn: boolean
    placeholder?: string
    submitLabel?: string
    compact?: boolean
}

export function DiscussionComposer({
    value,
    onChange,
    onSubmit,
    disabled,
    isSignedIn,
    placeholder = "Share your approach, edge case, or question.",
    submitLabel = "Post",
    compact,
}: DiscussionComposerProps) {
    const [mode, setMode] = useState<"write" | "preview">("write")
    const [submitting, setSubmitting] = useState(false)
    const canSubmit = isSignedIn && !disabled && value.trim().length > 0 && !submitting

    async function submit() {
        if (!canSubmit) return
        setSubmitting(true)
        try {
            await onSubmit()
            setMode("write")
        } finally {
            setSubmitting(false)
        }
    }

    if (!isSignedIn) {
        return (
            <div className="rounded-md border border-dashed border-border bg-surface-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">
                        Sign in to join the discussion.
                    </p>
                    <SignInDialogButton className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover active:scale-[0.96]">
                        Sign in
                    </SignInDialogButton>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-md border border-border bg-surface">
            <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
                <div className="inline-flex rounded-md border border-border bg-surface-muted/40 p-0.5">
                    <SegmentButton
                        active={mode === "write"}
                        onClick={() => setMode("write")}
                        icon={<PencilLine className="h-3.5 w-3.5" />}
                    >
                        Write
                    </SegmentButton>
                    <SegmentButton
                        active={mode === "preview"}
                        onClick={() => setMode("preview")}
                        icon={<Eye className="h-3.5 w-3.5" />}
                    >
                        Preview
                    </SegmentButton>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {value.length}
                </span>
            </div>
            {mode === "write" ? (
                <textarea
                    aria-label="Discussion comment"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={disabled || submitting}
                    placeholder={placeholder}
                    rows={compact ? 4 : 6}
                    className="block w-full resize-y border-0 bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                />
            ) : (
                <div className={cn("min-h-32 px-3 py-2.5", compact && "min-h-24")}>
                    <MarkdownRenderer content={value} empty="Nothing to preview." />
                </div>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-border px-2 py-2">
                <Button
                    type="button"
                    size="sm"
                    onClick={submit}
                    disabled={!canSubmit}
                >
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Posting" : submitLabel}
                </Button>
            </div>
        </div>
    )
}

function SegmentButton({
    active,
    onClick,
    icon,
    children,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium transition-colors active:scale-[0.96]",
                active
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
            )}
        >
            {icon}
            {children}
        </button>
    )
}
