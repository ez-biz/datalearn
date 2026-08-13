import { ArrowRight } from "lucide-react"
import type { TrackCurriculum } from "@/lib/curriculum-read"
import { LinkButton } from "@/components/ui/Button"
import { Card } from "@/components/ui/Card"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

interface TrackProgressCardProps {
    trackSlug: string
    curriculum: TrackCurriculum
}

/**
 * The track detail header's right-rail card for a track that has modules —
 * replaces the item-based progress card (`TrackProgressBar` + Start/
 * Continue/Review) that the `TrackItem` fallback still uses.
 *
 * "Continue module {n}" points at the first module whose rollup isn't
 * 100%, or the last module once every module is — same "somewhere to send
 * a learner who finished everything" fallback `resumeLesson` uses at the
 * module level (lib/learn/module-model.ts), just one level up.
 */
export function TrackProgressCard({
    trackSlug,
    curriculum,
}: TrackProgressCardProps) {
    const { rollup, modules } = curriculum
    const continueModule =
        modules.find((m) => m.rollup.percent < 100) ?? modules[modules.length - 1]
    const remainingMinutes = modules
        .flatMap((m) => m.lessons)
        .filter((lesson) => !lesson.completed)
        .reduce((sum, lesson) => sum + (lesson.readingMinutes ?? 0), 0)

    return (
        <Card className="border-primary/30 p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">
                    Track progress
                </span>
                <span className="font-mono text-[11px] tabular-nums text-primary">
                    {rollup.percent}%
                </span>
            </div>
            <div
                className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-panel-sunken"
                role="progressbar"
                aria-label="Track progress"
                aria-valuenow={rollup.percent}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${rollup.percent}%` }}
                />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Lessons
                    </dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">
                        {rollup.lessonsDone}/{rollup.lessonsTotal}
                    </dd>
                </div>
                <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Problems
                    </dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">
                        {rollup.problemsDone}/{rollup.problemsTotal}
                    </dd>
                </div>
                <div>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Remaining
                    </dt>
                    <dd className="mt-1 font-mono text-sm tabular-nums text-foreground">
                        {formatRemaining(remainingMinutes)}
                    </dd>
                </div>
            </dl>

            {continueModule && (
                <LinkButton
                    href={`/learn/tracks/${trackSlug}/modules/${continueModule.slug}`}
                    className="mt-5 w-full"
                >
                    Continue module {modulePrefix(continueModule.position)}
                    <ArrowRight className="size-4" aria-hidden="true" />
                </LinkButton>
            )}
        </Card>
    )
}

function formatRemaining(minutes: number): string {
    if (minutes <= 0) return "0m"
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}
