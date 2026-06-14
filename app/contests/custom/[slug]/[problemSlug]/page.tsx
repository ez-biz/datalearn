import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { getCustomContestBySlug } from "@/actions/custom-contests"
import { getProblem } from "@/actions/problems"
import { gatingFromStatus } from "@/lib/contests/play"
import { ContestPlayClient } from "@/components/contests/play/ContestPlayClient"
import { Container } from "@/components/ui/Container"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string; problemSlug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, problemSlug } = await params
    const contest = await getCustomContestBySlug(slug)
    return { title: contest ? `${contest.title} — ${problemSlug}` : "Contest" }
}

export default async function CustomContestPlayPage({ params }: Props) {
    const { slug, problemSlug } = await params

    const [contest, problemResult, session] = await Promise.all([
        getCustomContestBySlug(slug),
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
    // Custom contests have no registration step — any signed-in user is treated
    // as registered, so they drop straight into PLAY mode while LIVE.
    const mode = gatingFromStatus(
        contest.status,
        Boolean(viewerUserId),
        Boolean(viewerUserId)
    )
    const dialect = problem.dialects?.[0] ?? "DUCKDB"

    return (
        <Container width="2xl" className="py-8">
            <ContestPlayClient
                judge="PRACTICE"
                contestHref={`/contests/custom/${contest.slug}`}
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
