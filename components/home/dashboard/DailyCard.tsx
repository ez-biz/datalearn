import Link from "next/link"
import { CalendarCheck2, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { DifficultyBadge } from "@/components/ui/Badge"
import type { PlanInput } from "@/lib/home/today-plan"

type DailyInfo = PlanInput["daily"]

interface DailyCardProps {
    daily: DailyInfo
}

/**
 * The daily problem, with its full solved-today state. Kept separate from
 * `TodayPlan`'s daily row because `PlanRow` folds `solvedToday` into a
 * bare `done` boolean and drops `difficulty` into a formatted meta string —
 * this card wants the richer, unformatted fields directly.
 *
 * `daily` is null on a day with no published daily problem; that's shown
 * as an honest message, not hidden — unlike the cards gated by the
 * fallback rule, a daily-less day is expected steady-state, not a bug.
 */
export function DailyCard({ daily }: DailyCardProps) {
    return (
        <Card className="border-warning/30 p-5">
            <h2 className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-text-dim">
                <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
                Daily problem
            </h2>

            {daily ? (
                <Link
                    href={`/practice/${daily.slug}`}
                    className="-mx-2 mt-3 flex items-start gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-surface-hover"
                >
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate font-medium text-foreground">
                            {daily.title}
                        </h3>
                        <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                            {daily.solvedToday ? (
                                <>
                                    <CheckCircle2
                                        className="h-3 w-3 text-primary"
                                        aria-hidden="true"
                                    />
                                    Solved today
                                </>
                            ) : (
                                "Not solved today"
                            )}
                        </p>
                    </div>
                    <DifficultyBadge difficulty={daily.difficulty} />
                </Link>
            ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                    No published problem is available for today&apos;s daily.
                </p>
            )}
        </Card>
    )
}
