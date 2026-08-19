import type { FunnelStep } from "@/lib/analytics/funnel"

export function FunnelBar({ steps }: { steps: FunnelStep[] }) {
    // With no sign-ups there is no population to convert, so every rate
    // would be null and every bar empty. Say that instead of rendering
    // three blank rows.
    if (steps.length === 0 || steps[0].count === 0) {
        return (
            <p className="rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                No sign-ups in this window, so there is no funnel to report.
            </p>
        )
    }

    const startCount = steps[0].count

    return (
        <ol className="space-y-3">
            {steps.map((step) => {
                // Floor at 2% so a non-zero step is still visible as a sliver
                // rather than disappearing entirely.
                const width =
                    step.count === 0
                        ? 0
                        : Math.max(2, Math.round((step.count / startCount) * 100))

                return (
                    <li
                        key={step.key}
                        className="rounded-lg border border-border bg-surface p-4"
                    >
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="text-sm font-medium">{step.label}</span>
                            <span className="text-sm tabular-nums">
                                {step.count.toLocaleString()}
                                {step.rateFromPrevious !== null ? (
                                    <span className="ml-2 text-muted-foreground">
                                        {Math.round(step.rateFromPrevious * 100)}% of
                                        previous step
                                    </span>
                                ) : null}
                            </span>
                        </div>
                        <div
                            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
                            role="presentation"
                        >
                            <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${width}%` }}
                            />
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}
