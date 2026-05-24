import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { getContestBySlug } from "@/actions/contests"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { ContestStatusPill } from "@/components/contests/ContestStatusPill"
import { RegisterButton } from "@/components/contests/RegisterButton"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { Card, CardContent } from "@/components/ui/Card"
import { Container } from "@/components/ui/Container"
import { EmptyState } from "@/components/ui/EmptyState"
import { Eyebrow } from "@/components/ui/Eyebrow"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const contest = await getContestBySlug(slug)
    if (!contest) return { title: "Contest not found" }
    return { title: contest.title, description: contest.description }
}

export default async function ContestDetailPage({ params }: Props) {
    const { slug } = await params
    const contest = await getContestBySlug(slug)
    if (!contest) notFound()

    const session = await auth()
    const registration = session?.user?.id
        ? await prisma.contestRegistration.findUnique({
              where: {
                  contestId_userId: {
                      contestId: contest.id,
                      userId: session.user.id,
                  },
              },
              select: { contestId: true },
          })
        : null

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <Link
                href="/contests"
                className="mb-6 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                All contests
            </Link>

            <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
                <section>
                    <div className="flex flex-wrap items-center gap-2">
                        <Eyebrow variant="bracket">
                            {contest.kind.replace("_", " ")}
                        </Eyebrow>
                        <ContestStatusPill status={contest.status} />
                        <Badge variant={contest.rated ? "primary" : "outline"}>
                            {contest.rated ? "Rated" : "Unrated"}
                        </Badge>
                    </div>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                        {contest.title}
                    </h1>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
                        {contest.description}
                    </p>

                    <div className="mt-8">
                        <h2 className="mb-3 text-base font-semibold">
                            Problems
                        </h2>
                        {contest.problems.length === 0 ? (
                            <EmptyState
                                title={
                                    contest.status === "SCHEDULED"
                                        ? "Problems are hidden"
                                        : "No problems attached"
                                }
                                description={
                                    contest.status === "SCHEDULED"
                                        ? "The problem list unlocks when the contest goes live."
                                        : "This contest does not have public problems yet."
                                }
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
                                                    href={`/practice/${item.problem.slug}`}
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
                                                difficulty={
                                                    item.problem.difficulty
                                                }
                                            />
                                        </li>
                                    ))}
                                </ul>
                            </Card>
                        )}
                    </div>
                </section>

                <aside>
                    <Card>
                        <CardContent className="space-y-4 p-5">
                            <div>
                                <p className="text-xs uppercase text-muted-foreground">
                                    Starts
                                </p>
                                <p className="mt-1 text-sm font-medium tabular-nums">
                                    {contest.startsAt.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase text-muted-foreground">
                                    Ends
                                </p>
                                <p className="mt-1 text-sm font-medium tabular-nums">
                                    {contest.endsAt.toLocaleString()}
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">
                                        Problems
                                    </p>
                                    <p className="mt-1 font-medium tabular-nums">
                                        {contest.problemCount}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs uppercase text-muted-foreground">
                                        Registered
                                    </p>
                                    <p className="mt-1 font-medium tabular-nums">
                                        {contest.registrationCount}
                                    </p>
                                </div>
                            </div>
                            <RegisterButton
                                contestId={contest.id}
                                alreadyRegistered={Boolean(registration)}
                                disabled={contest.status === "CLOSED"}
                                isSignedIn={Boolean(session?.user?.id)}
                            />
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </Container>
    )
}
