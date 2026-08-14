import Link from "next/link"
import { Circle, CircleCheck } from "lucide-react"
import { Card } from "@/components/ui/Card"
import type { PlanRow } from "@/lib/home/today-plan"

interface TodayPlanProps {
    plan: PlanRow[]
}

/**
 * Renders `home.plan` exactly as given, in the order given. `getHomeData`
 * already composed it through `buildTodayPlan` — lesson, then daily, then
 * the next unsolved problem (dropped when it duplicates the daily) — so
 * this component must not insert, reorder, or re-filter rows. That
 * composition lives in exactly one place: lib/home/today-plan.ts.
 *
 * Renders nothing when the plan is empty rather than an empty card shell.
 */
export function TodayPlan({ plan }: TodayPlanProps) {
    if (plan.length === 0) return null

    return (
        <Card className="p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Today&apos;s plan
            </h2>
            <ul className="mt-3 divide-y divide-border">
                {plan.map((row) => (
                    <li key={row.kind}>
                        <Link
                            href={row.href}
                            className="-mx-2 grid grid-cols-[18px_1fr_90px] items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-panel-hover"
                        >
                            {row.done ? (
                                <CircleCheck
                                    aria-hidden="true"
                                    className="h-[18px] w-[18px] text-icon-done"
                                />
                            ) : (
                                <Circle
                                    aria-hidden="true"
                                    className="h-[18px] w-[18px] text-icon-off"
                                />
                            )}
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                    {row.title}
                                </span>
                                <span className="block font-mono text-[11px] tabular-nums text-text-dim">
                                    {row.meta}
                                </span>
                            </span>
                            <span className="justify-self-end text-xs font-medium text-primary">
                                Open →
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </Card>
    )
}
