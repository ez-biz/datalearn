import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { getContestLeaderboard } from "@/actions/contests"
import { getCustomContestBySlug } from "@/actions/custom-contests"
import { formatIST } from "@/lib/time-ist"
import { ContestStandings } from "@/components/contests/ContestStandings"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { CopyLinkButton } from "@/components/contests/custom/CopyLinkButton"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Container } from "@/components/ui/Container"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const contest = await getCustomContestBySlug(slug)
    if (!contest) return { title: "Contest not found" }
    return { title: contest.title, description: contest.description }
}

export default async function CustomContestDetailPage({ params }: Props) {
    const { slug } = await params
    const contest = await getCustomContestBySlug(slug)
    if (!contest) notFound()

    const session = await auth()
    const viewerUserId = session?.user?.id ?? null

    const shareUrl = `/contests/custom/${slug}`
    const showStandings =
        contest.status === "LIVE" || contest.status === "CLOSED"
    const standings = showStandings
        ? await getContestLeaderboard(contest.id)
        : []

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <Link
                href="/contests"
                className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                All contests
            </Link>

            <div className="flex flex-wrap items-center gap-2">
                <ContestStatusPill status={contest.status} />
                <Badge variant="outline">Friendly · unrated</Badge>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                {contest.title}
            </h1>

            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="tabular-nums">
                    Starts {formatIST(contest.startsAt)}
                </span>
                <span className="tabular-nums">
                    Ends {formatIST(contest.endsAt)}
                </span>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <code className="truncate rounded-md border border-border bg-surface-muted px-3 py-1.5 text-xs text-muted-foreground">
                    {shareUrl}
                </code>
                <CopyLinkButton url={shareUrl} />
            </div>

            <div className="mt-8">
                <h2 className="mb-3 text-base font-semibold">Problems</h2>
                {contest.status === "SCHEDULED" ? (
                    <EmptyState
                        title="Problems unlock when the contest starts"
                        description="Come back at the start time to play."
                    />
                ) : (
                    <Card className="overflow-hidden">
                        <ul className="divide-y divide-border">
                            {contest.problems.map((item) => (
                                <li
                                    key={item.problem.id}
                                    className="flex items-center gap-4 px-5 py-4"
                                >
                                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        {item.position}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <Link
                                            href={`/contests/custom/${slug}/${item.problem.slug}`}
                                            className="truncate font-medium hover:text-primary"
                                        >
                                            #{item.problem.number}.{" "}
                                            {item.problem.title}
                                        </Link>
                                    </div>
                                    <Badge variant="outline">
                                        {item.points} pts
                                    </Badge>
                                    <DifficultyBadge
                                        difficulty={item.problem.difficulty}
                                    />
                                </li>
                            ))}
                        </ul>
                    </Card>
                )}
            </div>

            {(contest.status === "LIVE" || contest.status === "CLOSED") && (
                <ContestStandings
                    rows={standings}
                    viewerUserId={viewerUserId}
                    status={contest.status}
                />
            )}
        </Container>
    )
}
