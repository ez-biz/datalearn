import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getContestBySlug } from "@/actions/contests"
import { getProblem } from "@/actions/problems"
import { gatingFromStatus } from "@/lib/contests/play"
import { ContestPlayClient } from "@/components/contests/play/ContestPlayClient"
import { Container } from "@/components/ui/Container"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string; problemSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, problemSlug } = await params
    const contest = await getContestBySlug(slug)
    return { title: contest ? `${contest.title} — ${problemSlug}` : "Contest" }
}

export default async function ContestPlayPage({ params }: Props) {
    const { slug, problemSlug } = await params

    const [contest, problemResult, session] = await Promise.all([
        getContestBySlug(slug),
        getProblem(problemSlug),
        auth(),
    ])
    if (!contest) notFound()

    const problem = problemResult.data
    if (!problem) notFound()

    // The problem must be attached to this contest.
    const attached = contest.problems.find(
        (item) => item.problem.slug === problemSlug
    )
    if (!attached) notFound()

    const viewerUserId = session?.user?.id ?? null
    const registration = viewerUserId
        ? await prisma.contestRegistration.findUnique({
              where: {
                  contestId_userId: {
                      contestId: contest.id,
                      userId: viewerUserId,
                  },
              },
              select: { contestId: true },
          })
        : null

    const mode = gatingFromStatus(
        contest.status,
        Boolean(viewerUserId),
        Boolean(registration)
    )
    const dialect = problem.dialects?.[0] ?? "DUCKDB"

    return (
        <Container width="2xl" className="py-8">
            <ContestPlayClient
                contestSlug={contest.slug}
                contestTitle={contest.title}
                endsAt={contest.endsAt.toISOString()}
                problem={{
                    id: attached.problem.id,
                    number: attached.problem.number,
                    title: attached.problem.title,
                    slug: attached.problem.slug,
                    schemaSql: problem.schema?.sql ?? null,
                    dialect,
                }}
                points={attached.points}
                mode={mode}
                siblings={contest.problems.map((item, index) => ({
                    letter: String.fromCharCode(65 + index),
                    slug: item.problem.slug,
                }))}
            />
        </Container>
    )
}
