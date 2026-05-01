import type { Metadata } from "next"
import Link from "next/link"
import {
    Award,
    BookOpen,
    Briefcase,
    Database,
    FileText,
    GraduationCap,
    Link as LinkIcon,
    Sparkles,
    Trophy,
} from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { getProfileData } from "@/actions/profile"
import { ActivityHeatmap } from "@/components/profile/ActivityHeatmap"
import { SolvedDonut } from "@/components/profile/SolvedDonut"
import { SkillsByTag } from "@/components/profile/SkillsByTag"
import { ProfileSidebar } from "@/components/profile/ProfileSidebar"
import { PlaceholderCard } from "@/components/profile/PlaceholderCard"

export const metadata: Metadata = {
    title: "Profile",
}

export default async function ProfilePage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/profile")
    }
    const data = await getProfileData()
    if (!data) {
        return (
            <Container width="md" className="py-12">
                <Card>
                    <CardContent className="p-8 text-center text-muted-foreground">
                        Couldn&apos;t load profile data right now. Try
                        refreshing the page.
                    </CardContent>
                </Card>
            </Container>
        )
    }

    const { user, totals, streak, heatmap, skills, recent } = data
    const heatmapTotal = heatmap.reduce((s, d) => s + d.count, 0)
    const isNew = totals.submissions === 0

    return (
        <Container width="xl" className="py-8 sm:py-10">
            <div className="grid gap-5 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]">
                {/* Sidebar */}
                <aside className="space-y-5">
                    <ProfileSidebar user={user} streak={streak} />
                </aside>

                {/* Main column */}
                <div className="space-y-5 min-w-0">
                    {/* Stats glance */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <Stat
                                    label="Solved"
                                    value={totals.solved}
                                    sub={`/ ${
                                        totals.totalsByDifficulty.EASY +
                                        totals.totalsByDifficulty.MEDIUM +
                                        totals.totalsByDifficulty.HARD
                                    }`}
                                />
                                <Stat
                                    label="Submissions"
                                    value={totals.submissions}
                                />
                                <Stat
                                    label="Acceptance"
                                    value={`${totals.acceptanceRate}%`}
                                />
                                <Stat
                                    label="Best streak"
                                    value={streak.longest}
                                    sub={
                                        streak.longest === 1 ? "day" : "days"
                                    }
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Activity heatmap */}
                    <Card>
                        <CardContent className="p-6">
                            {isNew ? (
                                <NewUserHero />
                            ) : (
                                <ActivityHeatmap
                                    series={heatmap}
                                    totalSubmissions={heatmapTotal}
                                />
                            )}
                        </CardContent>
                    </Card>

                    {/* Solved donut */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-base font-semibold tracking-tight mb-4 flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-muted-foreground" />
                                Solved by difficulty
                            </h2>
                            <SolvedDonut
                                solved={totals.solved}
                                total={
                                    totals.totalsByDifficulty.EASY +
                                    totals.totalsByDifficulty.MEDIUM +
                                    totals.totalsByDifficulty.HARD
                                }
                                solvedByDifficulty={totals.byDifficulty}
                                totalsByDifficulty={
                                    totals.totalsByDifficulty
                                }
                            />
                        </CardContent>
                    </Card>

                    {/* Skills */}
                    <Card>
                        <CardContent className="p-6">
                            <h2 className="text-base font-semibold tracking-tight mb-4 flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-muted-foreground" />
                                Skills
                            </h2>
                            <SkillsByTag skills={skills} />
                        </CardContent>
                    </Card>

                    {/* Recent activity */}
                    <Card>
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-base font-semibold tracking-tight flex items-center gap-2">
                                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    Recent activity
                                </h2>
                                {recent.length > 0 && (
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {recent.length} most recent
                                    </span>
                                )}
                            </div>
                            {recent.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No submissions yet — pick a problem and
                                    your activity will show up here.
                                </p>
                            ) : (
                                <ul className="divide-y divide-border -my-2">
                                    {recent.map((s) => {
                                        const ok = s.status === "ACCEPTED"
                                        return (
                                            <li key={s.id}>
                                                <Link
                                                    href={`/practice/${s.problem.slug}`}
                                                    className="group flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-md hover:bg-surface-muted transition-colors"
                                                >
                                                    <span
                                                        aria-hidden
                                                        className={cn(
                                                            "h-1.5 w-1.5 rounded-full shrink-0",
                                                            ok
                                                                ? "bg-easy"
                                                                : "bg-hard"
                                                        )}
                                                    />
                                                    <span className="flex-1 min-w-0 text-sm font-medium truncate group-hover:text-primary transition-colors">
                                                        {s.problem.title}
                                                    </span>
                                                    <DifficultyBadge
                                                        difficulty={
                                                            s.problem
                                                                .difficulty
                                                        }
                                                    />
                                                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
                                                        {s.createdAt.toLocaleDateString(
                                                            undefined,
                                                            {
                                                                month: "short",
                                                                day: "numeric",
                                                            }
                                                        )}
                                                    </span>
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}
                        </CardContent>
                    </Card>

                    {/* Placeholder sections — render in the layout now,
                        ready for schema work later. The "Coming soon"
                        pill makes it explicit they're not broken. */}
                    <div className="grid sm:grid-cols-2 gap-5">
                        <PlaceholderCard
                            icon={<Award className="h-4 w-4" />}
                            title="Contests"
                            description="Once contests launch, your rating, history, and rank will appear here."
                        />
                        <PlaceholderCard
                            icon={<Database className="h-4 w-4" />}
                            title="Languages / DBs"
                            description="When multi-dialect support lands (Postgres, MySQL, Hive…), submissions will be grouped by dialect."
                        />
                        <PlaceholderCard
                            icon={<Briefcase className="h-4 w-4" />}
                            title="Work experience"
                            description="Add roles for your portfolio. Visible on your public profile and resume export."
                        />
                        <PlaceholderCard
                            icon={<GraduationCap className="h-4 w-4" />}
                            title="Education"
                            description="Schools, degrees, and dates. Useful when sharing your profile externally."
                        />
                        <PlaceholderCard
                            icon={<FileText className="h-4 w-4" />}
                            title="Resume"
                            description="Upload a PDF; we'll keep the latest version available for download from your profile."
                        />
                        <PlaceholderCard
                            icon={<LinkIcon className="h-4 w-4" />}
                            title="Links"
                            description="GitHub, LinkedIn, personal site. Shown in the sidebar of your public profile."
                        />
                    </div>
                </div>
            </div>
        </Container>
    )
}

function Stat({
    label,
    value,
    sub,
}: {
    label: string
    value: string | number
    sub?: string
}) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
            </div>
            <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums">
                    {value}
                </span>
                {sub && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {sub}
                    </span>
                )}
            </div>
        </div>
    )
}

function NewUserHero() {
    return (
        <div className="text-center py-6">
            <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-3" />
            <h2 className="text-base font-semibold tracking-tight">
                Make your first submission to start your streak
            </h2>
            <p className="text-sm text-muted-foreground mt-1.5 max-w-md mx-auto">
                The activity heatmap, skills, and recent activity all light up
                from your first run. Start with an easy problem and the rest
                follows.
            </p>
            <div className="mt-4">
                <Link
                    href="/practice/simple-select"
                    className="text-sm text-primary hover:underline font-medium"
                >
                    Start with Simple Select →
                </Link>
            </div>
        </div>
    )
}
