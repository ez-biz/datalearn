import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { LinkButton } from "@/components/ui/Button"
import type { PlanRow } from "@/lib/home/today-plan"
import type { TrackSummary } from "@/lib/learn/tracks-read"
import type { HomeData } from "@/lib/home/home-read"

interface ResumeCardProps {
    /**
     * home.plan, unfiltered. This card never re-derives resume/next-problem
     * logic — it only *selects* rows buildTodayPlan already computed, which
     * is different from TodayPlan's contract (render the array as given, in
     * order): picking one row out of an already-built array doesn't change
     * that array's order or membership.
     */
    plan: PlanRow[]
    /** For the progress bar under a lesson resume target. Null when there
     *  is no featured track, or when the row shown is the practice fallback
     *  (a bar over "next unsolved problem" would claim a curriculum
     *  percentage that has nothing to do with that problem). */
    activeTrack: TrackSummary | null
    /**
     * home.catalogTotals — the only way to tell apart the two reasons
     * `plan` can end up with neither a lesson nor a problem row: the
     * learner solved every published problem (`total > 0 &&
     * solved === total`, which deserves the congratulatory state below), or
     * there is nothing published/assigned at all (`total === 0`, a
     * brand-new user or an empty catalog — never worth a "you finished!"
     * claim). See the restored-state doc comment below.
     */
    catalogTotals: HomeData["catalogTotals"]
}

/**
 * Hero card: "pick up where you stopped." Prefers the curriculum resume
 * target (buildTodayPlan's "lesson" row); falls back to the next unsolved
 * practice problem (the "problem" row) when there is no curriculum to
 * resume.
 *
 * When the plan has neither row, there are two honestly different reasons,
 * and this card must not conflate them (restores the "All caught up" state
 * the retired UserHome's RecommendedCard used to show, deleted without a
 * replacement when the dashboard was rebuilt):
 *  - The learner solved every published problem
 *    (`catalogTotals.total > 0 && catalogTotals.solved === catalogTotals.total`)
 *    — genuinely nothing left to resume or solve, so this renders the
 *    congratulatory "All caught up" card in the hero slot.
 *  - There is nothing to solve in the first place — an empty catalog, or a
 *    brand-new user with no curriculum and no problems
 *    (`catalogTotals.total === 0`) — which must NOT render that state; it
 *    would tell a learner they finished a catalog they never saw. This
 *    renders nothing, same as before this fix.
 *
 * A daily-only plan (no lesson/problem row, but `plan` itself non-empty)
 * falls through to the plain `null` return too — there is still something
 * to do today (the daily, shown by TodayPlan), so neither state applies.
 */
export function ResumeCard({ plan, activeTrack, catalogTotals }: ResumeCardProps) {
    const lessonRow = plan.find((row) => row.kind === "lesson")
    const problemRow = plan.find((row) => row.kind === "problem")
    const row = lessonRow ?? problemRow

    if (!row) {
        const allCaughtUp =
            plan.length === 0 &&
            catalogTotals.total > 0 &&
            catalogTotals.solved === catalogTotals.total
        if (!allCaughtUp) return null
        return (
            <Card className="border-primary/30 p-6">
                <Badge variant="primary">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    All caught up
                </Badge>
                <p className="mt-3 text-sm text-muted-foreground">
                    You&apos;ve solved every published problem. New ones drop
                    regularly — check back soon.
                </p>
            </Card>
        )
    }

    const percent = lessonRow && activeTrack ? activeTrack.rollup.percent : null

    return (
        <Card className="border-primary/30 p-6">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Pick up where you stopped
            </p>
            <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-tight text-foreground">
                {row.title}
            </h2>
            <p className="mt-1.5 font-mono text-[11px] tabular-nums text-text-dim">
                {row.meta}
            </p>

            {percent !== null && (
                <div
                    className="mt-4 h-1 overflow-hidden rounded-full bg-panel-sunken"
                    role="progressbar"
                    aria-label="Track progress"
                    aria-valuenow={percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            )}

            <LinkButton href={row.href} className="mt-5 h-[42px]">
                Resume
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </LinkButton>
        </Card>
    )
}
