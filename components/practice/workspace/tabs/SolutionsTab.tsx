"use client"

import Link from "next/link"
import { ChevronRight, Lock, Sparkles } from "lucide-react"
import { SolutionPanel } from "@/components/practice/SolutionPanel"
import type { Dialect } from "@/lib/sql-engine/types"
import type { DiscussionMode } from "@/components/practice/discussion/DiscussionPanel"
import { ApproachList } from "../ApproachList"

interface SolutionsTabProps {
    slug: string
    dialects: readonly Dialect[]
    activeDialect: Dialect
    isSignedIn: boolean
    isSolved: boolean
    discussionMode: DiscussionMode
    /** SQL to prefill the share composer with. */
    approachPrefill: string | null
    onApproachPrefillConsumed: () => void
}

/**
 * The canonical solution, promoted out from under the verdict.
 *
 * Before SP5 this rendered inside the Verdict pane and only in the moment
 * after an accepted submission — so a learner who solved a problem yesterday
 * had no way back to it. As a tab it is always reachable, and the gating is
 * unchanged: signed in, an accepted submission, and a deliberate reveal.
 *
 * The gate is enforced server-side by getProblemSolution regardless of what
 * this component renders; these states exist so the reason is legible rather
 * than a button that fails.
 *
 * Community approaches belong below this in phase 4. The canonical solution
 * stays above them — editorial content is never under user content.
 */
export function SolutionsTab({
    slug,
    dialects,
    activeDialect,
    isSignedIn,
    isSolved,
    discussionMode,
    approachPrefill,
    onApproachPrefillConsumed,
}: SolutionsTabProps) {
    return (
        <div className="space-y-4 p-5">
            <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-violet" aria-hidden />
                <h2 className="text-sm font-semibold">Canonical solution</h2>
            </div>

            {!isSignedIn ? (
                <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
                    <div className="flex items-start gap-3">
                        <Lock
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">
                                Sign in to see the canonical solution
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                We hide solutions from anonymous viewers. Sign in
                                (it&rsquo;s free) and your accepted submission
                                unlocks it.
                            </div>
                            <Link
                                href={`/auth/signin?callbackUrl=${encodeURIComponent(
                                    `/practice/${slug}`
                                )}`}
                                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                Sign in
                                <ChevronRight className="h-3 w-3" aria-hidden />
                            </Link>
                        </div>
                    </div>
                </div>
            ) : !isSolved ? (
                <div className="rounded-lg border border-border bg-surface-muted px-4 py-3">
                    <div className="flex items-start gap-3">
                        <Lock
                            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">
                                Solve it first
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                                The canonical solution unlocks once you have an
                                accepted submission. Hints are free in the
                                meantime.
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <SolutionPanel
                    slug={slug}
                    dialects={dialects}
                    activeDialect={activeDialect}
                />
            )}

            {/* Community approaches sit BELOW the canonical solution:
                editorial content is never under user content. HIDDEN removes
                the list entirely, which getApproaches enforces server-side. */}
            {discussionMode !== "HIDDEN" && (
                <ApproachList
                    slug={slug}
                    isSignedIn={isSignedIn}
                    locked={discussionMode === "LOCKED"}
                    prefill={approachPrefill}
                    onPrefillConsumed={onApproachPrefillConsumed}
                />
            )}
        </div>
    )
}
