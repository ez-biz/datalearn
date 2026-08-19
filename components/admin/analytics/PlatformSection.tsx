import {
    getFunnelCounts,
    getPlatformSeries,
    getRetentionInputs,
} from "@/lib/analytics/analytics-read"
import { cohortRetention, RETENTION_BUCKETS } from "@/lib/analytics/retention"
import { buildFunnel } from "@/lib/analytics/funnel"
import { computeDelta } from "@/lib/admin/metric-delta"
import type { DayBucket } from "@/lib/analytics/metric-windows"
import { StatTile } from "./StatTile"
import { RetentionTable } from "./RetentionTable"
import { FunnelBar } from "./FunnelBar"

function total(series: DayBucket[]): number {
    return series.reduce((sum, bucket) => sum + bucket.count, 0)
}

function secondHalf(series: DayBucket[]): number {
    return total(series.slice(Math.floor(series.length / 2)))
}

/**
 * The earlier half of the same window, or null when the window is too short
 * to split. Returning null means computeDelta emits no delta at all rather
 * than inventing a baseline of zero.
 */
function firstHalf(series: DayBucket[]): number | null {
    if (series.length < 2) return null
    return total(series.slice(0, Math.floor(series.length / 2)))
}

function halfDelta(series: DayBucket[]) {
    return computeDelta(secondHalf(series), firstHalf(series))
}

export async function PlatformSection({ windowDays }: { windowDays: number }) {
    const today = new Date()

    const [series, retentionInputs, funnelCounts] = await Promise.all([
        getPlatformSeries(windowDays, today),
        getRetentionInputs(windowDays, today),
        getFunnelCounts(windowDays, today),
    ])

    const submissions = total(series.submissions)
    const accepted = total(series.accepted)
    const halfWindow = Math.floor(windowDays / 2)

    const funnel = buildFunnel([
        { key: "signup", label: "Signed up", count: funnelCounts.signedUp },
        {
            key: "submitted",
            label: "Made a submission",
            count: funnelCounts.submitted,
        },
        { key: "accepted", label: "Solved a problem", count: funnelCounts.accepted },
    ])

    return (
        <div className="mt-8 space-y-10">
            <section aria-labelledby="platform-heading">
                <h2 id="platform-heading" className="text-lg font-semibold">
                    Platform
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Totals over the last {windowDays} days. Where a change is shown it
                    compares the most recent {halfWindow} days with the {halfWindow}{" "}
                    before them.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Sign-ups"
                        value={total(series.signups).toLocaleString()}
                        delta={halfDelta(series.signups)}
                        polarity="up-good"
                    />
                    <StatTile
                        label="Submissions"
                        value={submissions.toLocaleString()}
                        delta={halfDelta(series.submissions)}
                        polarity="up-good"
                    />
                    <StatTile
                        label="Acceptance rate"
                        value={
                            submissions === 0
                                ? "No submissions yet"
                                : `${Math.round((accepted / submissions) * 100)}%`
                        }
                        // Always show the denominator: "100%" over one
                        // submission is not the same claim as over a thousand.
                        footnote={
                            submissions === 0
                                ? undefined
                                : `${accepted.toLocaleString()} of ${submissions.toLocaleString()} submissions`
                        }
                        polarity="up-good"
                    />
                    <StatTile
                        label="Problems solved"
                        value={accepted.toLocaleString()}
                        delta={halfDelta(series.accepted)}
                        polarity="up-good"
                    />
                </div>
            </section>

            <section aria-labelledby="activity-heading">
                <h2 id="activity-heading" className="text-lg font-semibold">
                    Active learners
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Practice and lessons are counted separately and never added
                    together — someone can read a whole track without submitting
                    once, and anyone doing both would otherwise be counted twice.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <StatTile
                        label="Active in practice"
                        value={total(series.practiceActive).toLocaleString()}
                        delta={halfDelta(series.practiceActive)}
                        footnote="User-days with a submission"
                        polarity="up-good"
                    />
                    {/* No delta by design. LessonProgress.updatedAt is
                        overwritten per row, so this window total cannot be
                        split into halves — doing so would undercount the
                        earlier half by exactly the learners who returned. */}
                    <StatTile
                        label="Active in lessons"
                        value={series.learnActiveInWindow.toLocaleString()}
                        footnote={`Distinct learners in the last ${windowDays} days`}
                        polarity="up-good"
                    />
                    <StatTile
                        label="Lessons completed"
                        value={total(series.lessonsCompleted).toLocaleString()}
                        delta={halfDelta(series.lessonsCompleted)}
                        polarity="up-good"
                    />
                </div>
            </section>

            <section aria-labelledby="funnel-heading">
                <h2 id="funnel-heading" className="text-lg font-semibold">
                    New-user funnel
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Everyone who signed up in the last {windowDays} days, and how far
                    they got. Activity after the window still counts.
                </p>
                <div className="mt-4">
                    <FunnelBar steps={funnel} />
                </div>
            </section>

            <section aria-labelledby="retention-heading">
                <h2 id="retention-heading" className="text-lg font-semibold">
                    Retention
                </h2>
                <div className="mt-4 space-y-4">
                    {RETENTION_BUCKETS.map((bucketDays) => (
                        <RetentionTable
                            key={bucketDays}
                            bucketDays={bucketDays}
                            rows={cohortRetention(
                                retentionInputs.cohorts,
                                retentionInputs.activityByUser,
                                bucketDays,
                                today
                            )}
                        />
                    ))}
                </div>
            </section>
        </div>
    )
}
