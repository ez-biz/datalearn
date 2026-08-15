import { ArrowRight } from "lucide-react"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { HomeData } from "@/lib/home/home-read"
import type { UserStats } from "@/actions/submissions"
import type { PlanInput } from "@/lib/home/today-plan"
import { ResumeCard } from "./ResumeCard"
import { TodayPlan } from "./TodayPlan"
import { ModuleProgress } from "./ModuleProgress"
import { RecentSubmissions } from "./RecentSubmissions"
import { StreakCard } from "./StreakCard"
import { DailyCard } from "./DailyCard"
import { WeakSpotsCard } from "./WeakSpotsCard"

interface SignedInHomeProps {
    name: string | null
    home: HomeData
    stats: UserStats
    /** Passed separately from `home` — DailyCard needs the full status
     *  (including `solvedToday`), which `home.plan`'s daily row does not
     *  carry. See lib/home/home-read.ts and TodayPlan's own doc comment. */
    daily: PlanInput["daily"]
}

const DIFFICULTY_ROWS: Array<{
    key: "EASY" | "MEDIUM" | "HARD"
    label: string
    bar: string
}> = [
    { key: "EASY", label: "Easy", bar: "bg-easy" },
    { key: "MEDIUM", label: "Medium", bar: "bg-medium" },
    { key: "HARD", label: "Hard", bar: "bg-hard" },
]

/**
 * Assembles the seven presentational dashboard cards into the signed-in
 * home page. Owns only what none of the seven cards can: the greeting
 * (needs `name`), the "X of Y solved" subtitle (solved/total both come from
 * `home.catalogTotals`; only the trailing submissions count still needs
 * `stats.submissions`) and the progress-by-difficulty card (entirely
 * `home.catalogTotals`, numerator and denominator alike — see
 * `ProgressByDifficulty`'s own doc comment), and the two-column layout.
 *
 * Layout is two columns at `lg` and up (matches the retired UserHome's own
 * breakpoint), single column below it — this task covers desktop/tablet
 * only, per SP6's task split; the mobile pass is later.
 *
 * The fallback rule (production ships zero modules/lessons today) means
 * ResumeCard, TodayPlan and ModuleProgress frequently render nothing. The
 * left column never goes empty regardless, because RecentSubmissions
 * always renders — a card shell with an honest empty state, never null —
 * and the right rail never goes empty because StreakCard (a real "0", not
 * a fallback) and DailyCard (an honest "no daily today" message) never
 * return null either. `lg:items-start` keeps the two columns independently
 * sized so a long `ModuleProgress` grid (a track can have many modules —
 * analyst-interview-prep has 17) never forces the shorter right rail to
 * stretch or overflow.
 */
export function SignedInHome({ name, home, stats, daily }: SignedInHomeProps) {
    const greeting = name ? `Welcome back, ${name.split(" ")[0]}.` : "Welcome back."

    return (
        <div className="flex-1 bg-background">
            <Container width="xl" className="py-10 sm:py-14">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                            {greeting}
                        </h1>
                        <p className="mt-2 text-sm tabular-nums text-muted-foreground">
                            {home.catalogTotals.solved} of {home.catalogTotals.total}{" "}
                            problems solved · {stats.submissions} submissions all
                            time
                        </p>
                    </div>
                    <LinkButton
                        href="/practice"
                        variant="outline"
                        size="sm"
                        className="self-start sm:self-auto"
                    >
                        Browse all problems
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </LinkButton>
                </div>

                <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
                    <div className="flex flex-col gap-6 lg:col-span-2">
                        <ResumeCard plan={home.plan} activeTrack={home.activeTrack} />
                        <TodayPlan plan={home.plan} />
                        <ModuleProgress activeTrack={home.activeTrack} />
                        <RecentSubmissions recent={stats.recent} />
                    </div>
                    <div className="flex flex-col gap-6">
                        <StreakCard streak={home.streak} week={home.week} />
                        <DailyCard daily={daily} />
                        <WeakSpotsCard weakSpots={home.weakSpots} />
                        <ProgressByDifficulty
                            solved={home.catalogTotals.solvedByDifficulty}
                            total={home.catalogTotals.byDifficulty}
                        />
                    </div>
                </div>
            </Container>
        </div>
    )
}

/**
 * Solved/total bars per difficulty, restoring UserHome's ProgressCard.
 * Both `solved` (`home.catalogTotals.solvedByDifficulty`) and `total`
 * (`home.catalogTotals.byDifficulty`) are counted from the exact same
 * `getCatalogProblems` read that `/practice` itself renders from
 * (PUBLISHED only, contest-locked problems already excluded there), so
 * neither this card's numerator nor its denominator can disagree with the
 * catalog page's — and `solved` can never exceed `total`, unlike
 * `UserStats.byDifficulty`, which counts ACCEPTED submissions with no
 * catalog-membership check.
 */
function ProgressByDifficulty({
    solved,
    total,
}: {
    solved: HomeData["catalogTotals"]["solvedByDifficulty"]
    total: HomeData["catalogTotals"]["byDifficulty"]
}) {
    return (
        <Card className="p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Progress by difficulty
            </h2>
            <ul className="mt-3 space-y-3">
                {DIFFICULTY_ROWS.map(({ key, label, bar }) => {
                    const solvedCount = solved[key]
                    const totalCount = total[key]
                    const pct =
                        totalCount > 0
                            ? Math.min(100, Math.round((solvedCount / totalCount) * 100))
                            : 0
                    return (
                        <li key={key}>
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-foreground">
                                    {label}
                                </span>
                                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                    {solvedCount} / {totalCount}
                                </span>
                            </div>
                            <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-panel-sunken">
                                <div
                                    className={cn(
                                        "h-full rounded-full transition-[width] duration-300",
                                        bar
                                    )}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </li>
                    )
                })}
            </ul>
        </Card>
    )
}
