import type { CohortRetention } from "@/lib/analytics/retention"

export function RetentionTable({
    bucketDays,
    rows,
}: {
    bucketDays: number
    rows: CohortRetention[]
}) {
    if (rows.length === 0) {
        return (
            <div className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium">D{bucketDays}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    No sign-ups in this window, so there is no cohort to follow.
                </p>
            </div>
        )
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
                <caption className="px-4 pt-4 text-left text-sm font-medium">
                    D{bucketDays} retention
                    <span className="ml-2 font-normal text-muted-foreground">
                        still active {bucketDays} day{bucketDays === 1 ? "" : "s"} after
                        signing up
                    </span>
                </caption>
                <thead>
                    <tr className="text-left text-muted-foreground">
                        <th scope="col" className="px-4 py-2 font-medium">
                            Cohort
                        </th>
                        <th scope="col" className="px-4 py-2 font-medium">
                            Signed up
                        </th>
                        <th scope="col" className="px-4 py-2 font-medium">
                            Retained
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.cohortDay} className="border-t border-border">
                            <td className="px-4 py-2 tabular-nums">{row.cohortDay}</td>
                            <td className="px-4 py-2 tabular-nums">{row.cohortSize}</td>
                            <td className="px-4 py-2 tabular-nums">
                                {/* null means day N has not yet arrived for this
                                    cohort. Rendering 0% would read as total churn
                                    rather than as "too early to tell". */}
                                {row.rate === null || row.retained === null ? (
                                    <span className="text-muted-foreground">
                                        Not enough history yet
                                    </span>
                                ) : (
                                    <>
                                        {Math.round(row.rate * 100)}%{" "}
                                        <span className="text-muted-foreground">
                                            ({row.retained} of {row.cohortSize})
                                        </span>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
