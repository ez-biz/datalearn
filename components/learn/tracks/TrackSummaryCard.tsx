import Link from "next/link"
import { ArrowRight, CircleCheck } from "lucide-react"
import type { TrackSummary } from "@/lib/learn/tracks-read"
import { Card } from "@/components/ui/Card"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

type TrackSummaryCardProps = {
    track: TrackSummary
    /** 0-indexed position in the list — rendered as the mono number chip.
     *  Track has no stable display number of its own (unlike
     *  SQLProblem.number), so this is the card's position in the page's
     *  fetch order, same zero-padded 1-based shape modulePrefix already
     *  gives module numbers. */
    index: number
}

/**
 * One row of the tracks index: `grid 36px 1fr` — a mono number chip, the
 * title/description, a mono lessons/problems/hrs line, and a progress row
 * of bar · percentage · Resume.
 *
 * Deliberately two separate links (title -> track detail, "Resume"/
 * "Continue" -> the resume lesson or the track detail page) rather than one
 * Link wrapping the whole card like the old TrackCard did — those hrefs
 * differ whenever `resume` is set, and nesting an <a> inside an <a> is
 * invalid HTML.
 *
 * `resume` is null in THREE different situations, and only one of them
 * means "done":
 *   1. No lessons at all (`rollup.lessonsTotal === 0`) — nothing to resume
 *      or complete.
 *   2. Every lesson is read but a checkpoint problem is still unsolved —
 *      `findResume` (lib/learn/tracks-read.ts) only scans lessons, so it
 *      reports null here even though `rollup.percent` (lessons + problems,
 *      lib/curriculum-progress.ts) is under 100. This used to render "✓
 *      Complete" next to a sub-100% number — the whole-branch review that
 *      caught it found a learner who read every lesson but solved no
 *      problems on `analyst-interview-prep`, where the track detail page
 *      simultaneously said "Continue module 01". `isComplete` below is
 *      `rollup.percent === 100`, not `resume === null`, specifically so
 *      this case renders as "not complete" here too.
 *   3. Every lesson AND every problem is done — genuinely complete.
 * The brief is explicit that none of the three may render a dead
 * "Resume ->", so (1) still reads "No lessons yet", (2) gets a working
 * "Continue" link to the track detail page (the same place
 * TrackProgressCard's "Continue module NN" button already sends this
 * learner), and only (3) renders "Complete".
 */
export function TrackSummaryCard({ track, index }: TrackSummaryCardProps) {
    const { rollup, resume } = track
    const hasLessons = rollup.lessonsTotal > 0
    // rollup.percent counts lessons AND problems in one denominator, so this
    // agrees with the track detail page (TrackProgressCard shows the same
    // rollup) and the module screen (a module's rollup is the same shape one
    // level down) — `resume === null` alone does not, see the doc above.
    const isComplete = rollup.percent === 100

    return (
        <Card className="grid grid-cols-[36px_1fr] gap-3 p-5">
            <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-panel-sunken font-mono text-[11px] tabular-nums text-text-dim"
            >
                {modulePrefix(index)}
            </span>

            <div className="min-w-0">
                <Link
                    href={`/learn/tracks/${track.slug}`}
                    className="block text-base font-semibold leading-tight tracking-tight text-foreground transition-colors hover:text-primary"
                >
                    {track.name}
                </Link>
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-text-muted">
                    {track.summary}
                </p>
                <p className="mt-3 font-mono text-[11px] tabular-nums text-text-dim">
                    {hasLessons && `${track.lessonsTotal} lessons · `}
                    {track.problemsTotal} problems ·{" "}
                    {formatHours(track.estimatedMinutes)} hrs
                </p>

                <div className="mt-3 flex items-center gap-3">
                    <div
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-sunken"
                        role="progressbar"
                        aria-label={`${track.name} progress`}
                        aria-valuenow={rollup.percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div
                            className="h-full rounded-full bg-primary transition-[width] duration-300"
                            style={{ width: `${rollup.percent}%` }}
                        />
                    </div>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-primary">
                        {rollup.percent}%
                    </span>

                    {resume ? (
                        <Link
                            href={`/learn/tracks/${track.slug}/${resume.lessonSlug}`}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                        >
                            Resume
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    ) : isComplete ? (
                        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-text-muted">
                            <CircleCheck
                                className="h-3.5 w-3.5 text-primary"
                                aria-hidden="true"
                            />
                            Complete
                        </span>
                    ) : hasLessons ? (
                        <Link
                            href={`/learn/tracks/${track.slug}`}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                        >
                            Continue
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    ) : track.nextItemSlug ? (
                        // Item-only track: no lessons to resume, but there is
                        // a next unsolved problem. Before this the card said
                        // "No lessons yet" while the detail page listed a full
                        // study sequence — true of every published track on
                        // production at release time.
                        <Link
                            href={`/practice/${track.nextItemSlug}`}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                        >
                            {rollup.problemsDone > 0 ? "Resume" : "Start"}
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    ) : track.problemsTotal > 0 ? (
                        <Link
                            href={`/learn/tracks/${track.slug}`}
                            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                        >
                            Review
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </Link>
                    ) : (
                        <span className="shrink-0 text-sm text-text-dim">
                            Nothing here yet
                        </span>
                    )}
                </div>
            </div>
        </Card>
    )
}

function formatHours(minutes: number): string {
    const rounded = Math.round((minutes / 60) * 10) / 10
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
