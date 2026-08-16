"use client"

import Link from "next/link"
import { ArrowRight, Loader2, Play, RotateCcw, Send } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Kbd } from "@/components/ui/Kbd"
import type { CheckpointContext } from "@/lib/workspace/queries"

interface ActionBarProps {
    onRun: () => void
    onSubmit: () => void
    onReset?: () => void
    showSubmit: boolean
    runDisabled: boolean
    submitDisabled: boolean
    submitting: boolean
    loading: boolean
    dbReady: boolean
    runTitle: string
    submitTitle: string
    modKey: string
    checkpointContext: CheckpointContext | null
}

/**
 * Run / Submit, and the curriculum's next step.
 *
 * flex-wrap and min-w-0 are load-bearing here: at 1440px with the problems
 * panel open this column is ~554px, and before SP5's four-column layout the
 * same controls had ~860px. Without wrapping they overflow and clip the
 * right-most button rather than moving to a second line.
 *
 * Below `lg`, Run and Submit grow to equal-width 46px touch targets and take
 * the row's first line on their own (flex-wrap pushes Reset and the
 * checkpoint link to a second line). Reset also grows to a 46px touch
 * target below `lg` — same floor as Run/Submit, just not flex-1 since it
 * doesn't need to stretch to fill the row. At `lg`+ all three reset to
 * their original `size="sm"` dimensions — unchanged from before this task.
 */
export function ActionBar({
    onRun,
    onSubmit,
    onReset,
    showSubmit,
    runDisabled,
    submitDisabled,
    submitting,
    loading,
    dbReady,
    runTitle,
    submitTitle,
    modKey,
    checkpointContext,
}: ActionBarProps) {
    const next = checkpointContext?.nextProblemSlug
    const lesson = checkpointContext
        ? `/learn/tracks/${checkpointContext.trackSlug}/${checkpointContext.lessonSlug}`
        : null

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={onRun}
                disabled={runDisabled}
                title={runTitle}
                data-testid="workspace-run-footer"
                className="h-[46px] flex-1 lg:h-8 lg:flex-none"
            >
                {!dbReady ? (
                    <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span className="hidden sm:inline">Engine loading…</span>
                    </>
                ) : (
                    <>
                        <Play className="h-3.5 w-3.5" />
                        <span>▸ Run</span>
                        <Kbd>{modKey}↵</Kbd>
                    </>
                )}
            </Button>

            {showSubmit && (
                <Button
                    size="sm"
                    onClick={onSubmit}
                    disabled={submitDisabled}
                    title={submitTitle}
                    className="h-[46px] flex-1 lg:h-8 lg:flex-none"
                >
                    {submitting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Checking…
                        </>
                    ) : (
                        <>
                            <Send className="h-3.5 w-3.5" />
                            <span>Submit</span>
                            <Kbd tone="on-primary">{modKey}⇧↵</Kbd>
                        </>
                    )}
                </Button>
            )}

            {onReset && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    disabled={loading || submitting}
                    title="Reset draft (clears editor and removes saved local draft)"
                    className="h-[46px] lg:h-8"
                >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                </Button>
            )}

            <p className="hidden text-[11px] text-muted-foreground lg:block">
                Run executes locally · Submit records the attempt.
            </p>

            {/* The curriculum's next step, pushed right. Absent for catalog
                problems; "Back to lesson" on the last checkpoint, since
                advancing to the next lesson is the reader's job. */}
            {checkpointContext && lesson && (
                <Link
                    href={next ? `/practice/${next}` : lesson}
                    className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors duration-150 hover:bg-primary/20"
                >
                    {next ? "Next checkpoint" : "Back to lesson"}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
            )}
        </div>
    )
}
