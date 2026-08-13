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
 * Deliberately two separate links (title -> track detail, "Resume" ->
 * the resume lesson) rather than one Link wrapping the whole card like the
 * old TrackCard did — those two hrefs differ whenever `resume` is set, and
 * nesting an <a> inside an <a> is invalid HTML.
 *
 * `resume` is null in two different situations — no lessons at all, or
 * every lesson already complete — and the brief is explicit that neither
 * may render a dead "Resume ->". Both fall through to a plain-text status
 * instead of a link.
 */
export function TrackSummaryCard({ track, index }: TrackSummaryCardProps) {
    const { rollup, resume } = track
    const hasLessons = rollup.lessonsTotal > 0
    const isComplete = hasLessons && resume === null

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
                    {track.lessonsTotal} lessons · {track.problemsTotal} problems ·{" "}
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
                    ) : (
                        <span className="shrink-0 text-sm text-text-dim">
                            No lessons yet
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
