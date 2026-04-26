import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, History as HistoryIcon, Trophy, XCircle } from "lucide-react"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Container } from "@/components/ui/Container"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"
import { getUserStats } from "@/actions/submissions"

export const metadata: Metadata = {
    title: "Profile",
}

export default async function ProfilePage() {
    const session = await auth()
    if (!session?.user) {
        redirect("/api/auth/signin?callbackUrl=/profile")
    }

    const stats = await getUserStats()
    const initials = (session.user.name ?? session.user.email ?? "?")
        .charAt(0)
        .toUpperCase()
    const acceptanceRate =
        stats && stats.submissions > 0
            ? Math.round((stats.accepted / stats.submissions) * 100)
            : null

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <Card className="mb-8">
                <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-5">
                        {session.user.image ? (
                            <Image
                                src={session.user.image}
                                alt={session.user.name ?? "User"}
                                width={72}
                                height={72}
                                className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-border"
                            />
                        ) : (
                            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-primary/15 text-2xl font-semibold text-primary">
                                {initials}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-2xl font-semibold tracking-tight truncate">
                                    {session.user.name ?? "Unnamed user"}
                                </h1>
                                {session.user.role === "ADMIN" && (
                                    <Badge variant="accent">Admin</Badge>
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-0.5 truncate">
                                {session.user.email}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!stats ? (
                <Card>
                    <CardContent className="p-8">
                        <p className="text-sm text-muted-foreground">
                            Couldn&apos;t load stats right now.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <StatCard
                            icon={<Trophy className="h-4 w-4" />}
                            label="Solved"
                            value={stats.solved}
                        />
                        <StatCard
                            icon={<HistoryIcon className="h-4 w-4" />}
                            label="Submissions"
                            value={stats.submissions}
                        />
                        <StatCard
                            icon={<CheckCircle2 className="h-4 w-4" />}
                            label="Acceptance"
                            value={acceptanceRate != null ? `${acceptanceRate}%` : "—"}
                        />
                        <StatCard
                            icon={<XCircle className="h-4 w-4" />}
                            label="Wrong"
                            value={stats.submissions - stats.accepted}
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>By difficulty</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <DifficultyBar
                                    label="Easy"
                                    count={stats.byDifficulty.EASY}
                                    color="bg-easy"
                                />
                                <DifficultyBar
                                    label="Medium"
                                    count={stats.byDifficulty.MEDIUM}
                                    color="bg-medium"
                                />
                                <DifficultyBar
                                    label="Hard"
                                    count={stats.byDifficulty.HARD}
                                    color="bg-hard"
                                />
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Recent activity</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {stats.recent.length === 0 ? (
                                    <EmptyState
                                        icon={<HistoryIcon className="h-5 w-5" />}
                                        title="No submissions yet"
                                        description="Solve a problem to start your activity feed."
                                        action={
                                            <LinkButton href="/practice" size="sm">
                                                Browse problems
                                            </LinkButton>
                                        }
                                    />
                                ) : (
                                    <ul className="-mx-2 divide-y divide-border">
                                        {stats.recent.map((s) => (
                                            <li key={s.id}>
                                                <Link
                                                    href={`/practice/${s.problem.slug}`}
                                                    className="flex items-center gap-3 px-2 py-2.5 rounded-md hover:bg-surface-muted/60 transition-colors"
                                                >
                                                    {s.status === "ACCEPTED" ? (
                                                        <CheckCircle2 className="h-4 w-4 text-easy shrink-0" />
                                                    ) : (
                                                        <XCircle className="h-4 w-4 text-hard shrink-0" />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {s.problem.title}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground tabular-nums">
                                                            {formatRelative(s.createdAt)}
                                                        </p>
                                                    </div>
                                                    <DifficultyBadge
                                                        difficulty={s.problem.difficulty}
                                                    />
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </Container>
    )
}

function StatCard({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode
    label: string
    value: string | number
}) {
    return (
        <Card>
            <CardContent className="p-5">
                <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
                        {label}
                    </span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {icon}
                    </span>
                </div>
                <p className="mt-3 text-2xl font-semibold tabular-nums">{value}</p>
            </CardContent>
        </Card>
    )
}

function DifficultyBar({
    label,
    count,
    color,
}: {
    label: string
    count: number
    color: string
}) {
    const max = Math.max(count, 1)
    return (
        <div>
            <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums text-muted-foreground">{count}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted overflow-hidden">
                <div
                    className={`h-full ${color} transition-[width] duration-500 ease-out`}
                    style={{ width: `${Math.min(100, (count / max) * 100)}%` }}
                />
            </div>
        </div>
    )
}

function formatRelative(date: Date | string): string {
    const t = typeof date === "string" ? new Date(date) : date
    const diffMs = Date.now() - t.getTime()
    const sec = Math.round(diffMs / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.round(hr / 24)
    if (day < 30) return `${day}d ago`
    return t.toLocaleDateString()
}
