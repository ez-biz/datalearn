import {
    FAILURE_CATEGORIES,
    FAILURE_LABELS,
    type FailureCategory,
} from "@/lib/analytics/failure-taxonomy"
import { cn } from "@/lib/utils"

/**
 * PROBLEM_DEFECT is not a learner failing — it means this problem's own
 * expected output is malformed, so every submission against it fails no
 * matter what the learner writes. It is the one category that is an
 * authoring bug, so it is called out rather than listed as just another bar.
 */
const AUTHORING_BUG: FailureCategory = "PROBLEM_DEFECT"

export function FailureBreakdown({
    tally,
}: {
    tally: Record<FailureCategory, number>
}) {
    const total = FAILURE_CATEGORIES.reduce(
        (sum, category) => sum + tally[category],
        0
    )

    if (total === 0) {
        return (
            <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                No failed submissions recorded for this problem.
            </p>
        )
    }

    return (
        <div className="rounded-lg border border-border bg-surface p-4">
            <ul className="space-y-3">
                {/* Every category renders, including zeros. Dropping a zero row
                    would read as "this never happens" rather than "none in this
                    data", and would hide a rising OTHER share — which is how a
                    changed validator message announces itself. */}
                {FAILURE_CATEGORIES.map((category) => {
                    const count = tally[category]
                    const share = count / total
                    const isAuthoringBug = category === AUTHORING_BUG && count > 0

                    return (
                        <li key={category}>
                            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                <span
                                    className={cn(
                                        "text-sm",
                                        isAuthoringBug
                                            ? "font-medium text-destructive"
                                            : count === 0
                                              ? "text-muted-foreground"
                                              : undefined
                                    )}
                                >
                                    {FAILURE_LABELS[category]}
                                    {isAuthoringBug ? (
                                        <span className="ml-2 text-xs font-normal">
                                            authoring bug — fix the problem, not
                                            the learner
                                        </span>
                                    ) : null}
                                </span>
                                <span className="text-sm tabular-nums text-muted-foreground">
                                    {count.toLocaleString()}
                                    {count > 0
                                        ? ` · ${Math.round(share * 100)}%`
                                        : null}
                                </span>
                            </div>
                            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                    className={cn(
                                        "h-1.5 rounded-full",
                                        isAuthoringBug
                                            ? "bg-destructive"
                                            : "bg-primary"
                                    )}
                                    style={{ width: `${Math.round(share * 100)}%` }}
                                />
                            </div>
                        </li>
                    )
                })}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
                {total.toLocaleString()} failed submission
                {total === 1 ? "" : "s"} classified from the validator&rsquo;s own
                messages. A rising &ldquo;Unclassified&rdquo; share means a
                validator message changed and the taxonomy needs updating.
            </p>
        </div>
    )
}
