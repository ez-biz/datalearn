import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { getProblemDetail } from "@/lib/analytics/analytics-read"
import { acceptanceRate } from "@/lib/analytics/problem-ranking"
import { Container } from "@/components/ui/Container"
import { FailureBreakdown } from "@/components/admin/analytics/FailureBreakdown"
import { StatTile } from "@/components/admin/analytics/StatTile"

export const metadata: Metadata = {
    title: "Problem analytics",
    robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ProblemAnalyticsPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    await requireAdminPage()
    const { slug } = await params

    const detail = await getProblemDetail(slug)
    if (!detail) notFound()

    const rate = acceptanceRate(detail)
    const firstTryRate =
        detail.distinctAttempters === 0
            ? null
            : detail.firstTryAccepted / detail.distinctAttempters

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <Link
                href="/admin/analytics"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
            >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Analytics
            </Link>

            <h1 className="mt-3 text-2xl font-semibold">
                {detail.number}. {detail.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
                All-time submission history for this problem.{" "}
                <Link
                    href={`/problems/${detail.slug}`}
                    className="underline hover:text-primary"
                >
                    Open the problem
                </Link>
                .
            </p>

            {detail.attempts === 0 ? (
                // Nothing to break down. Rendering empty charts and a 0%
                // acceptance rate would claim this problem is unsolvable when
                // nobody has tried it.
                <p className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                    No submissions for this problem yet, so there is nothing to
                    report. Acceptance and failure breakdowns appear once someone
                    attempts it.
                </p>
            ) : (
                <div className="mt-8 space-y-10">
                    <section aria-labelledby="detail-summary-heading">
                        <h2
                            id="detail-summary-heading"
                            className="text-lg font-semibold"
                        >
                            Summary
                        </h2>
                        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatTile
                                label="Attempts"
                                value={detail.attempts.toLocaleString()}
                                footnote={`${detail.distinctAttempters.toLocaleString()} distinct learners`}
                            />
                            <StatTile
                                label="Solvers"
                                value={detail.distinctSolvers.toLocaleString()}
                                footnote={`of ${detail.distinctAttempters.toLocaleString()} who attempted`}
                                polarity="up-good"
                            />
                            <StatTile
                                label="Acceptance"
                                value={
                                    rate === null
                                        ? "No attempts yet"
                                        : `${Math.round(rate * 100)}%`
                                }
                                footnote={
                                    rate === null
                                        ? undefined
                                        : `${detail.accepted.toLocaleString()} of ${detail.attempts.toLocaleString()} submissions`
                                }
                                polarity="up-good"
                            />
                            <StatTile
                                label="Solved first try"
                                value={
                                    firstTryRate === null
                                        ? "No attempts yet"
                                        : `${Math.round(firstTryRate * 100)}%`
                                }
                                footnote={
                                    firstTryRate === null
                                        ? undefined
                                        : `${detail.firstTryAccepted.toLocaleString()} of ${detail.distinctAttempters.toLocaleString()} learners`
                                }
                                polarity="up-good"
                            />
                        </div>
                    </section>

                    <section aria-labelledby="attempts-heading">
                        <h2 id="attempts-heading" className="text-lg font-semibold">
                            Attempts before solving
                        </h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Counts each learner&rsquo;s submissions up to their first
                            acceptance. Learners who have not solved it are not
                            shown — they have no first solve yet.
                        </p>
                        {detail.attemptsPerSolver.length === 0 ? (
                            <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                                Nobody has solved this problem yet.
                            </p>
                        ) : (
                            <ul className="mt-4 space-y-2 rounded-lg border border-border bg-surface p-4">
                                {detail.attemptsPerSolver.map((bucket) => (
                                    <li
                                        key={bucket.attempts}
                                        className="flex items-baseline justify-between gap-4 text-sm"
                                    >
                                        <span>
                                            Solved on attempt{" "}
                                            <span className="tabular-nums">
                                                {bucket.attempts}
                                            </span>
                                        </span>
                                        <span className="tabular-nums text-muted-foreground">
                                            {bucket.solvers.toLocaleString()} learner
                                            {bucket.solvers === 1 ? "" : "s"}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>

                    <section aria-labelledby="failures-heading">
                        <h2 id="failures-heading" className="text-lg font-semibold">
                            Why submissions failed
                        </h2>
                        <div className="mt-4">
                            <FailureBreakdown tally={detail.failureTally} />
                        </div>
                    </section>
                </div>
            )}
        </Container>
    )
}
