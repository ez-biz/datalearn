import { ArrowRight } from "lucide-react"
import { Container } from "@/components/ui/Container"
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

const DIFFICULTY_DOTS: Array<{
    key: "EASY" | "MEDIUM" | "HARD"
    label: string
    dot: string
}> = [
    { key: "EASY", label: "Easy", dot: "bg-easy" },
    { key: "MEDIUM", label: "Medium", dot: "bg-medium" },
    { key: "HARD", label: "Hard", dot: "bg-hard" },
]

/**
 * Assembles the seven presentational dashboard cards into the signed-in
 * home page. Owns only what none of the seven cards can: the greeting
 * (needs `name`), the "solved by difficulty" strip (needs `stats` but maps
 * to no single card), and the two-column layout.
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
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                            <span className="tabular-nums">
                                {stats.solved} solved · {stats.submissions} submissions
                                all time
                            </span>
                            <span
                                className="hidden h-3 w-px bg-border sm:inline"
                                aria-hidden="true"
                            />
                            <span className="inline-flex items-center gap-3">
                                {DIFFICULTY_DOTS.map(({ key, label, dot }) => (
                                    <span
                                        key={key}
                                        className="inline-flex items-center gap-1.5"
                                    >
                                        <span
                                            className={cn(
                                                "h-1.5 w-1.5 rounded-full",
                                                dot
                                            )}
                                            aria-hidden="true"
                                        />
                                        {label}{" "}
                                        <span className="font-medium tabular-nums text-foreground">
                                            {stats.byDifficulty[key]}
                                        </span>
                                    </span>
                                ))}
                            </span>
                        </div>
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
                    </div>
                </div>
            </Container>
        </div>
    )
}
