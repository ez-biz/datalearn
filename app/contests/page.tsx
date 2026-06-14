import type { Metadata } from "next"
import Link from "next/link"
import { CalendarDays, Plus, Trophy } from "lucide-react"
import { listContests } from "@/actions/contests"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { Badge } from "@/components/ui/Badge"
import { Card, CardContent } from "@/components/ui/Card"
import { Container } from "@/components/ui/Container"
import { EmptyState } from "@/components/ui/EmptyState"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { LinkButton } from "@/components/ui/Button"
import { formatIST } from "@/lib/time-ist"

export const metadata: Metadata = {
    title: "Contests",
    description: "Upcoming, live, and past Data Learn SQL contests.",
}
export const dynamic = "force-dynamic"

export default async function ContestsPage() {
    const contests = await listContests()
    const live = contests.filter((contest) => contest.status === "LIVE")
    const upcoming = contests.filter(
        (contest) => contest.status === "SCHEDULED"
    )
    const past = contests.filter((contest) => contest.status === "CLOSED")

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                    <Eyebrow variant="bracket" className="mb-1">
                        COMPETE
                    </Eyebrow>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Contests
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Timed SQL rounds with curated problems, registration,
                        and post-contest standings.
                    </p>
                </div>
                <LinkButton
                    href="/contests/custom/new"
                    variant="outline"
                    className="shrink-0"
                >
                    <Plus className="h-4 w-4" />
                    Create your own contest
                </LinkButton>
            </header>

            {contests.length === 0 ? (
                <EmptyState
                    icon={<Trophy className="h-5 w-5" />}
                    title="No contests scheduled"
                    description="Upcoming weekly and special contests will appear here."
                />
            ) : (
                <div className="space-y-8">
                    <ContestGroup title="Live" contests={live} />
                    <ContestGroup title="Upcoming" contests={upcoming} />
                    <ContestGroup title="Past" contests={past} />
                </div>
            )}
        </Container>
    )
}

function ContestGroup({
    title,
    contests,
}: {
    title: string
    contests: Awaited<ReturnType<typeof listContests>>
}) {
    if (contests.length === 0) return null
    return (
        <section>
            <Eyebrow className="mb-3">{title}</Eyebrow>
            <div className="grid gap-3 md:grid-cols-2">
                {contests.map((contest) => (
                    <Link key={contest.id} href={`/contests/${contest.slug}`}>
                        <Card className="h-full transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h2 className="truncate text-base font-semibold">
                                            {contest.title}
                                        </h2>
                                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                            {contest.description}
                                        </p>
                                    </div>
                                    <ContestStatusPill
                                        status={contest.status}
                                    />
                                </div>
                                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="outline">
                                        {contest.kind.toLowerCase()}
                                    </Badge>
                                    <span className="inline-flex items-center gap-1 tabular-nums">
                                        <CalendarDays className="h-3.5 w-3.5" />
                                        {formatIST(contest.startsAt)}
                                    </span>
                                    <span className="tabular-nums">
                                        {contest.problemCount} problems
                                    </span>
                                    <span className="tabular-nums">
                                        {contest.registrationCount} registered
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </section>
    )
}
