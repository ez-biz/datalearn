import Link from "next/link"
import {
    getCounterDriftReport,
    getProblemPerformance,
    getTrackCompletion,
} from "@/lib/analytics/analytics-read"
import { acceptanceRate, rankByAcceptance } from "@/lib/analytics/problem-ranking"
import { DriftIndicator } from "./DriftIndicator"

function percent(share: number): string {
    return `${Math.round(share * 100)}%`
}

export async function ContentSection() {
    const [problems, tracks, drift] = await Promise.all([
        getProblemPerformance(),
        getTrackCompletion(),
        getCounterDriftReport(),
    ])

    const ranked = rankByAcceptance(problems)
    const anyAttempts = problems.some((problem) => problem.attempts > 0)

    return (
        <div className="mt-10 space-y-10">
            <section aria-labelledby="content-heading">
                <h2 id="content-heading" className="text-lg font-semibold">
                    Problem performance
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Published problems, worst acceptance first. Rates are computed
                    from submission history, so they are correct even when the
                    catalog&rsquo;s cached counters are not. Problems nobody has
                    attempted sort last — untried is unknown, not bad.
                </p>

                <div className="mt-4">
                    <DriftIndicator report={drift} />
                </div>

                {problems.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                        No published problems yet.
                    </p>
                ) : !anyAttempts ? (
                    <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                        No submissions recorded against any of the{" "}
                        {problems.length.toLocaleString()} published problems yet, so
                        there are no acceptance rates to report.
                    </p>
                ) : (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
                        <table className="w-full text-sm">
                            <caption className="px-4 pt-4 text-left text-sm font-medium">
                                Per-problem acceptance
                            </caption>
                            <thead>
                                <tr className="text-left text-muted-foreground">
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        #
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Problem
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Attempts
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Solvers
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Acceptance
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        First try
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {ranked.map((problem) => {
                                    const rate = acceptanceRate(problem)
                                    const firstTryRate =
                                        problem.distinctAttempters === 0
                                            ? null
                                            : problem.firstTryAccepted /
                                              problem.distinctAttempters

                                    return (
                                        <tr
                                            key={problem.problemId}
                                            className="border-t border-border"
                                        >
                                            <td className="px-4 py-2 tabular-nums">
                                                {problem.number}
                                            </td>
                                            <td className="px-4 py-2">
                                                <Link
                                                    href={`/problems/${problem.slug}`}
                                                    className="hover:text-primary"
                                                >
                                                    {problem.title}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-2 tabular-nums">
                                                {problem.attempts.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 tabular-nums">
                                                {problem.distinctSolvers.toLocaleString()}
                                            </td>
                                            {/* A dash, never 0% — nobody has tried
                                                this problem, so it has no rate. */}
                                            <td className="px-4 py-2 tabular-nums">
                                                {rate === null ? (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                ) : (
                                                    <>
                                                        {percent(rate)}{" "}
                                                        <span className="text-muted-foreground">
                                                            ({problem.accepted} of{" "}
                                                            {problem.attempts})
                                                        </span>
                                                    </>
                                                )}
                                            </td>
                                            <td className="px-4 py-2 tabular-nums">
                                                {firstTryRate === null ? (
                                                    <span className="text-muted-foreground">
                                                        —
                                                    </span>
                                                ) : (
                                                    <>
                                                        {percent(firstTryRate)}{" "}
                                                        <span className="text-muted-foreground">
                                                            ({problem.firstTryAccepted}{" "}
                                                            of{" "}
                                                            {
                                                                problem.distinctAttempters
                                                            }
                                                            )
                                                        </span>
                                                    </>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section aria-labelledby="tracks-heading">
                <h2 id="tracks-heading" className="text-lg font-semibold">
                    Track completion
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Published tracks. A learner counts as completed only once every
                    lesson in the track is finished.
                </p>

                {tracks.length === 0 ? (
                    <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                        No published tracks yet.
                    </p>
                ) : (
                    <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
                        <table className="w-full text-sm">
                            <caption className="px-4 pt-4 text-left text-sm font-medium">
                                Per-track completion
                            </caption>
                            <thead>
                                <tr className="text-left text-muted-foreground">
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Track
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Lessons
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Learners started
                                    </th>
                                    <th scope="col" className="px-4 py-2 font-medium">
                                        Completed
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {tracks.map((track) => (
                                    <tr
                                        key={track.trackId}
                                        className="border-t border-border"
                                    >
                                        <td className="px-4 py-2">
                                            <Link
                                                href={`/learn/tracks/${track.slug}`}
                                                className="hover:text-primary"
                                            >
                                                {track.name}
                                            </Link>
                                        </td>
                                        <td className="px-4 py-2 tabular-nums">
                                            {track.lessonCount}
                                        </td>
                                        <td className="px-4 py-2 tabular-nums">
                                            {track.learnersStarted.toLocaleString()}
                                        </td>
                                        {/* A track with no lessons cannot be
                                            completed. Saying so beats "0%", which
                                            is the shape that caused the v0.9.1
                                            hotfix on the tracks index. */}
                                        <td className="px-4 py-2 tabular-nums">
                                            {track.lessonCount === 0 ? (
                                                <span className="text-muted-foreground">
                                                    No lessons yet
                                                </span>
                                            ) : (
                                                <>
                                                    {track.learnersCompleted.toLocaleString()}
                                                    {track.learnersStarted > 0 ? (
                                                        <span className="text-muted-foreground">
                                                            {" "}
                                                            of{" "}
                                                            {track.learnersStarted.toLocaleString()}{" "}
                                                            started
                                                        </span>
                                                    ) : null}
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    )
}
