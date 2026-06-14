import type { Metadata } from "next"
import Link from "next/link"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getProblems } from "@/actions/problems"
import { deriveContestStatus } from "@/lib/contest-status"
import { canCreateCustomContest } from "@/lib/contests/custom"
import { CreateCustomContestForm } from "@/components/contests/custom/CreateCustomContestForm"
import { Card, CardContent } from "@/components/ui/Card"
import { Container } from "@/components/ui/Container"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { LinkButton } from "@/components/ui/Button"

export const metadata: Metadata = {
    title: "Create a contest",
    description: "Spin up a friendly, unrated SQL contest and share the link.",
}
export const dynamic = "force-dynamic"

export default async function CreateCustomContestPage() {
    const session = await auth()
    const userId = session?.user?.id ?? null

    if (!userId) {
        return (
            <Container width="lg" className="py-10 sm:py-14">
                <Card>
                    <CardContent className="p-8 text-center">
                        <h1 className="text-xl font-semibold tracking-tight">
                            Sign in to create a contest
                        </h1>
                        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                            Custom contests are friendly, unrated SQL rounds you
                            can share by link. Sign in to create one.
                        </p>
                        <div className="mt-5 flex justify-center">
                            <LinkButton
                                href={`/auth/signin?callbackUrl=${encodeURIComponent(
                                    "/contests/custom/new"
                                )}`}
                            >
                                Sign in
                            </LinkButton>
                        </div>
                    </CardContent>
                </Card>
            </Container>
        )
    }

    // Count the user's active (derived status != CLOSED) custom contests, same
    // logic createCustomContest enforces, to decide whether they're at the cap.
    const existing = await prisma.contest.findMany({
        where: { kind: "USER_CUSTOM", createdById: userId },
        select: { startsAt: true, endsAt: true, status: true },
    })
    const now = new Date()
    const activeCount = existing.filter(
        (row) =>
            deriveContestStatus(row.startsAt, row.endsAt, row.status, now) !==
            "CLOSED"
    ).length
    const atCap = !canCreateCustomContest(activeCount)

    const problemsResult = await getProblems()
    const publishedProblems = problemsResult.data.map((problem) => ({
        id: problem.id,
        number: problem.number,
        title: problem.title,
    }))

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8">
                <Eyebrow variant="bracket" className="mb-1">
                    COMPETE
                </Eyebrow>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                    Create a contest
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Pick problems, set an IST window, and share the link.
                    Anyone with the link can join — no registration. Back to{" "}
                    <Link
                        href="/contests"
                        className="text-primary hover:underline"
                    >
                        all contests
                    </Link>
                    .
                </p>
            </header>

            <CreateCustomContestForm
                publishedProblems={publishedProblems}
                atCap={atCap}
            />
        </Container>
    )
}
