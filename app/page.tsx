import { Container } from "@/components/ui/Container"
import { getProblems } from "@/actions/problems"
import { getTopics } from "@/actions/content"
import { auth } from "@/lib/auth"
import { getDailyStatusForCurrentUser } from "@/actions/daily"
import { getUserStats } from "@/actions/submissions"
import { getHomeData } from "@/lib/home/home-read"
import type { PlanInput } from "@/lib/home/today-plan"
import { SignedInHome } from "@/components/home/dashboard/SignedInHome"
import { getTrackSummariesForUser } from "@/lib/learn/tracks-read"
import { Hero, type HeroCounts } from "@/components/home/marketing/Hero"
import { PathPreview } from "@/components/home/marketing/PathPreview"
import { HowItWorks } from "@/components/home/marketing/HowItWorks"
import { Proof } from "@/components/home/marketing/Proof"

export default async function Home() {
    const [{ data: problems }, { data: topics }, session] = await Promise.all([
        getProblems(),
        getTopics(),
        auth(),
    ])

    // Logged-in users get a personalized dashboard. Anonymous visitors get
    // the marketing pitch below.
    if (session?.user?.id) {
        // Two phases, not one three-way Promise.all: getHomeData consumes
        // the daily status (it composes the whole "today's plan" — lesson,
        // daily, next problem — in one place, buildTodayPlan), so it can't
        // start until the daily read resolves. Stats and daily still
        // overlap; only the home read is serialized behind them. Costs one
        // extra round trip, deliberately, over having SignedInHome re-derive
        // buildTodayPlan's ordering/de-dup rules itself.
        const [stats, dailyStatus] = await Promise.all([
            getUserStats(),
            getDailyStatusForCurrentUser(),
        ])
        if (stats) {
            // Bridge actions/daily.ts's DailyStatus (nested problem summary)
            // to lib/home/today-plan.ts's flatter PlanInput["daily"] shape —
            // the two are deliberately distinct types (see home-read.ts's
            // and today-plan.ts's own doc comments on why daily stays a
            // separate session-resolving action), so getHomeData and
            // SignedInHome both need the flattened version.
            const daily: PlanInput["daily"] = dailyStatus.daily
                ? {
                      slug: dailyStatus.daily.problem.slug,
                      title: dailyStatus.daily.problem.title,
                      difficulty: dailyStatus.daily.problem.difficulty,
                      solvedToday: dailyStatus.solvedToday,
                  }
                : null
            const home = await getHomeData(session.user.id, daily)
            return (
                <SignedInHome
                    name={session.user.name ?? null}
                    home={home}
                    stats={stats}
                    daily={daily}
                />
            )
        }
        // If getUserStats failed (DB blip), fall through to the anonymous
        // page rather than rendering a broken dashboard.
    }

    // getTrackSummariesForUser(null): every published track, anonymous
    // viewer (so every rollup reports 0% — nothing has been read or solved
    // yet), in fetch order. Only fetched here in the anonymous branch —
    // the signed-in branch above never reaches this line, so a signed-in
    // request never pays for a query it doesn't use.
    const tracks = await getTrackSummariesForUser(null)

    const totalProblems = problems?.length ?? 0
    const totalTopics = topics?.length ?? 0
    const totalArticles =
        topics?.reduce((sum: number, t: any) => sum + (t._count?.articles ?? 0), 0) ?? 0
    // Sum of every published track's lessonsTotal — 0 on production today
    // (zero ModuleLesson rows anywhere), which is exactly why Hero has to
    // be able to drop this clause instead of rendering "0 lessons".
    const totalLessons = tracks.reduce((sum, t) => sum + t.lessonsTotal, 0)

    const heroCounts: HeroCounts = {
        problems: totalProblems,
        lessons: totalLessons,
        tracks: tracks.length,
        topics: totalTopics,
        articles: totalArticles,
    }

    return (
        <div className="flex-1">
            {/* Hero + path preview */}
            <section className="relative overflow-hidden border-b border-border">
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_hsl(var(--primary)/0.08),_transparent_60%)]"
                />
                <div
                    aria-hidden
                    className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,hsl(var(--border)/0.6)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.6)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-40"
                />
                <Container width="xl" className="py-16 sm:py-20 lg:py-24">
                    <div className="grid gap-10 lg:grid-cols-[1fr_470px] lg:items-start">
                        <Hero
                            firstTrackSlug={tracks[0]?.slug ?? null}
                            counts={heroCounts}
                        />
                        <PathPreview tracks={tracks} />
                    </div>
                </Container>
            </section>

            {/* How it works */}
            <section className="border-b border-border bg-surface">
                <Container width="xl" className="py-16 sm:py-20">
                    <HowItWorks />
                </Container>
            </section>

            {/* Proof */}
            <section>
                <Container width="xl" className="py-16 sm:py-20">
                    <Proof />
                </Container>
            </section>
        </div>
    )
}
