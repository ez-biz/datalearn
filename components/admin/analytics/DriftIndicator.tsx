import { CircleCheck, TriangleAlert } from "lucide-react"
import type { DriftReport } from "@/lib/analytics/counter-drift"

const MAX_LISTED = 10

export function DriftIndicator({ report }: { report: DriftReport }) {
    // A zero result is stated, not omitted. Rendering nothing here would be
    // indistinguishable from "we never checked".
    if (report.drifted.length === 0) {
        return (
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
                <CircleCheck
                    className="mt-0.5 h-4 w-4 shrink-0 text-easy"
                    aria-hidden="true"
                />
                <p className="text-sm text-muted-foreground">
                    Pass-rate counters match submission history across all{" "}
                    {report.checked.toLocaleString()} problems.
                </p>
            </div>
        )
    }

    const listed = report.drifted.slice(0, MAX_LISTED)

    return (
        <div className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
                <TriangleAlert
                    className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                    aria-hidden="true"
                />
                <div>
                    <p className="text-sm font-medium">
                        {report.drifted.length.toLocaleString()} of{" "}
                        {report.checked.toLocaleString()} problems have drifted
                        pass-rate counters
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        The catalog shows pass rates from denormalized counters,
                        which are not decremented when a user is deleted. The rates
                        on this page are computed from submissions and are correct.
                        Repair the counters with{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            npm run verify:pass-rate -- --fix
                        </code>
                        .
                    </p>
                </div>
            </div>

            <ul className="mt-3 space-y-1 text-sm">
                {listed.map((row) => (
                    <li key={row.problemId} className="text-muted-foreground">
                        <span className="tabular-nums">#{row.number}</span> {row.title}{" "}
                        <span className="tabular-nums">
                            — attempts {row.attemptDrift > 0 ? "+" : ""}
                            {row.attemptDrift}, accepted{" "}
                            {row.acceptedDrift > 0 ? "+" : ""}
                            {row.acceptedDrift}
                        </span>
                    </li>
                ))}
            </ul>

            {/* Silent truncation would read as complete coverage. */}
            {report.drifted.length > MAX_LISTED ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    Showing the {MAX_LISTED} largest of{" "}
                    {report.drifted.length.toLocaleString()}.
                </p>
            ) : null}
        </div>
    )
}
