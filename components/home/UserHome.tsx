import Link from "next/link"
import {
    ArrowRight,
    BookOpen,
    CheckCircle2,
    Clock,
    Compass,
    Sparkles,
    XCircle,
} from "lucide-react"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { LinkButton } from "@/components/ui/Button"
import { cn } from "@/lib/utils"
import type { UserStats } from "@/actions/submissions"

type PublicProblem = {
    id: string
    number: number
    slug: string
    title: string
    description: string | null
    difficulty: string
}

interface UserHomeProps {
    name: string | null
    stats: UserStats
    problems: PublicProblem[]
    solvedSlugs: string[]
}

const RECENT_LIMIT = 5

function formatRelative(date: Date): string {
    const diff = Date.now() - date.getTime()
    const minutes = Math.round(diff / 60_000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 30) return `${days}d ago`
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function UserHome({ name, stats, problems, solvedSlugs }: UserHomeProps) {
    const solvedSet = new Set(solvedSlugs)
    const totalByDifficulty = { EASY: 0, MEDIUM: 0, HARD: 0 } as Record<
        "EASY" | "MEDIUM" | "HARD",
        number
    >
    for (const p of problems) {
        const d = p.difficulty as "EASY" | "MEDIUM" | "HARD"
        if (totalByDifficulty[d] !== undefined) totalByDifficulty[d]++
    }
    const totalProblems = problems.length

    const continueProblem = stats.recent[0]
    const recommended = problems.find((p) => !solvedSet.has(p.slug)) ?? null
    const recent = stats.recent.slice(0, RECENT_LIMIT)
    const isNew = stats.submissions === 0

    const greeting = name ? `Welcome back, ${name.split(" ")[0]}.` : "Welcome back."

    return (
        <main className="flex-1 bg-background">
            <Container width="xl" className="py-10 sm:py-14">
                {/* Greeting strip */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                            {greeting}
                        </h1>
                        <p className="text-sm text-muted-foreground mt-1">
                            {isNew
                                ? "Pick a problem to get started — your first run unlocks the rest of this page."
                                : `${stats.solved} of ${totalProblems} problems solved · ${stats.submissions} submissions all time`}
                        </p>
                    </div>
                    <LinkButton
                        href="/practice"
                        variant="outline"
                        size="sm"
                        className="self-start sm:self-auto"
                    >
                        Browse all problems
                        <ArrowRight className="h-3.5 w-3.5" />
                    </LinkButton>
                </div>

                {isNew ? (
                    <NewUserHero />
                ) : (
                    <div className="grid gap-4 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <ContinueCard
                                problem={continueProblem ?? null}
                                solved={
                                    continueProblem
                                        ? solvedSet.has(
                                              continueProblem.problem.slug
                                          )
                                        : false
                                }
                            />
                        </div>
                        <ProgressCard
                            byDifficulty={stats.byDifficulty}
                            total={totalByDifficulty}
                        />
                        <RecommendedCard problem={recommended} />
                        <div className="lg:col-span-2">
                            <RecentActivityCard items={recent} />
                        </div>
                    </div>
                )}
            </Container>
        </main>
    )
}

function NewUserHero() {
    return (
        <Card>
            <CardContent className="p-8 sm:p-10 flex flex-col sm:flex-row sm:items-center gap-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                    <h2 className="text-lg font-semibold tracking-tight">
                        Your first SQL run is one click away
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1.5">
                        Start with an Easy problem like{" "}
                        <Link
                            href="/practice/simple-select"
                            className="text-primary hover:underline"
                        >
                            Simple Select
                        </Link>{" "}
                        or browse the full library. Everything runs in your browser
                        — no setup.
                    </p>
                </div>
                <div className="flex gap-2">
                    <LinkButton href="/practice/simple-select" size="md">
                        Start with an easy one
                    </LinkButton>
                    <LinkButton href="/practice" variant="outline" size="md">
                        Browse all
                    </LinkButton>
                </div>
            </CardContent>
        </Card>
    )
}

function ContinueCard({
    problem,
    solved,
}: {
    problem: UserStats["recent"][number] | null
    solved: boolean
}) {
    if (!problem) {
        return (
            <Card>
                <CardContent className="p-6">
                    <SectionHeading
                        icon={<Clock className="h-3.5 w-3.5" />}
                        label="Continue"
                    />
                    <p className="mt-3 text-sm text-muted-foreground">
                        No recent activity. Pick something from the library.
                    </p>
                    <div className="mt-4">
                        <LinkButton href="/practice" variant="outline" size="sm">
                            Browse problems
                            <ArrowRight className="h-3.5 w-3.5" />
                        </LinkButton>
                    </div>
                </CardContent>
            </Card>
        )
    }
    const wasAccepted = problem.status === "ACCEPTED"
    return (
        <Card>
            <CardContent className="p-6">
                <SectionHeading
                    icon={<Clock className="h-3.5 w-3.5" />}
                    label={solved ? "Recently solved" : "Continue where you left off"}
                />
                <Link
                    href={`/practice/${problem.problem.slug}`}
                    className="group mt-4 -mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-muted transition-colors"
                >
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            <span className="text-muted-foreground tabular-nums mr-1">
                                {problem.problem.number}.
                            </span>
                            {problem.problem.title}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-2 tabular-nums">
                            <span
                                className={cn(
                                    "inline-flex items-center gap-1",
                                    wasAccepted
                                        ? "text-easy-fg"
                                        : "text-muted-foreground"
                                )}
                            >
                                {wasAccepted ? (
                                    <CheckCircle2 className="h-3 w-3" />
                                ) : (
                                    <XCircle className="h-3 w-3" />
                                )}
                                {wasAccepted ? "Accepted" : "Wrong answer"}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{formatRelative(problem.createdAt)}</span>
                        </p>
                    </div>
                    <DifficultyBadge difficulty={problem.problem.difficulty} />
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-[color,translate] duration-150" />
                </Link>
            </CardContent>
        </Card>
    )
}

function ProgressCard({
    byDifficulty,
    total,
}: {
    byDifficulty: UserStats["byDifficulty"]
    total: Record<"EASY" | "MEDIUM" | "HARD", number>
}) {
    const rows: Array<{
        key: "EASY" | "MEDIUM" | "HARD"
        label: string
        bar: string
    }> = [
        { key: "EASY", label: "Easy", bar: "bg-easy" },
        { key: "MEDIUM", label: "Medium", bar: "bg-medium" },
        { key: "HARD", label: "Hard", bar: "bg-hard" },
    ]
    return (
        <Card>
            <CardContent className="p-6">
                <SectionHeading
                    icon={<Sparkles className="h-3.5 w-3.5" />}
                    label="Your progress"
                />
                <div className="mt-4 space-y-3">
                    {rows.map(({ key, label, bar }) => {
                        const solved = byDifficulty[key]
                        const totalCount = total[key] || 1
                        const pct = Math.min(100, (solved / totalCount) * 100)
                        return (
                            <div key={key}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                    <span className="font-medium">{label}</span>
                                    <span className="tabular-nums text-muted-foreground">
                                        {solved} / {total[key] ?? 0}
                                    </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-surface-muted overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full transition-[width] duration-500 ease-out",
                                            bar
                                        )}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}

function RecommendedCard({ problem }: { problem: PublicProblem | null }) {
    return (
        <Card>
            <CardContent className="p-6">
                <SectionHeading
                    icon={<Compass className="h-3.5 w-3.5" />}
                    label="Recommended next"
                />
                {problem ? (
                    <Link
                        href={`/practice/${problem.slug}`}
                        className="group mt-4 -mx-2 flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-muted transition-colors"
                    >
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                                <span className="text-muted-foreground tabular-nums mr-1">
                                    {problem.number}.
                                </span>
                                {problem.title}
                            </h3>
                            {problem.description && (
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {problem.description}
                                </p>
                            )}
                        </div>
                        <DifficultyBadge difficulty={problem.difficulty} />
                    </Link>
                ) : (
                    <div className="mt-4">
                        <Badge variant="primary">
                            <CheckCircle2 className="h-3 w-3" />
                            All caught up
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-2">
                            You've solved every published problem. New ones drop
                            regularly — check back soon.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function RecentActivityCard({
    items,
}: {
    items: UserStats["recent"]
}) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <SectionHeading
                        icon={<BookOpen className="h-3.5 w-3.5" />}
                        label="Recent activity"
                    />
                    <Link
                        href="/profile"
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        See all →
                    </Link>
                </div>
                <ul className="mt-3 divide-y divide-border">
                    {items.map((s) => {
                        const ok = s.status === "ACCEPTED"
                        return (
                            <li key={s.id}>
                                <Link
                                    href={`/practice/${s.problem.slug}`}
                                    className="group flex items-center gap-3 py-2.5 -mx-2 px-2 rounded-md hover:bg-surface-muted transition-colors"
                                >
                                    <span
                                        className={cn(
                                            "h-1.5 w-1.5 rounded-full shrink-0",
                                            ok ? "bg-easy" : "bg-hard"
                                        )}
                                        aria-hidden
                                    />
                                    <span className="flex-1 min-w-0 text-sm font-medium truncate group-hover:text-primary transition-colors">
                                        <span className="text-muted-foreground tabular-nums mr-1 font-normal">
                                            {s.problem.number}.
                                        </span>
                                        {s.problem.title}
                                    </span>
                                    <DifficultyBadge
                                        difficulty={s.problem.difficulty}
                                    />
                                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:inline">
                                        {formatRelative(s.createdAt)}
                                    </span>
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </CardContent>
        </Card>
    )
}

function SectionHeading({
    icon,
    label,
}: {
    icon: React.ReactNode
    label: string
}) {
    return (
        <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {icon}
            {label}
        </h2>
    )
}
