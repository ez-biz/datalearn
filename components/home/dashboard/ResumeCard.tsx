import { ArrowRight } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import type { PlanRow } from "@/lib/home/today-plan"
import type { TrackSummary } from "@/lib/learn/tracks-read"

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
}

/**
 * Hero card: "pick up where you stopped." Prefers the curriculum resume
 * target (buildTodayPlan's "lesson" row); falls back to the next unsolved
 * practice problem (the "problem" row) when there is no curriculum to
 * resume. Renders nothing when the plan has neither — a brand-new learner
 * with an empty catalog, or a learner who has solved everything and has no
 * track in progress.
 */
export function ResumeCard({ plan, activeTrack }: ResumeCardProps) {
    const lessonRow = plan.find((row) => row.kind === "lesson")
    const problemRow = plan.find((row) => row.kind === "problem")
    const row = lessonRow ?? problemRow
    if (!row) return null

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
