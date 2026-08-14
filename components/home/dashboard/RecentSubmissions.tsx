import Link from "next/link"
import { CheckCircle2, History, XCircle } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"
import type { UserStats } from "@/actions/submissions"

interface RecentSubmissionsProps {
    recent: UserStats["recent"]
}

function formatRelative(date: Date): string {
    const diffMs = Date.now() - date.getTime()
    const sec = Math.round(diffMs / 1000)
    if (sec < 60) return `${sec}s ago`
    const min = Math.round(sec / 60)
    if (min < 60) return `${min}m ago`
    const hr = Math.round(min / 60)
    if (hr < 24) return `${hr}h ago`
    const day = Math.round(hr / 24)
    if (day < 30) return `${day}d ago`
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

/**
 * Recent submission rows on `grid 1fr 120px 90px`: problem, verdict chip,
 * relative time.
 *
 * The design's original spec included a fourth "runtime" column, dropped
 * here: `Submission` (prisma/schema.prisma) does not capture query
 * execution time anywhere in the schema, on this model or any other
 * (checked ContestSubmission/ContestProblemSolve too — same story). This
 * project's precedent (SP4) is to omit an unbacked design block rather than
 * stub it — a permanent "—" is dead UI that implies a feature that doesn't
 * exist. Ships zero migrations; add the column back if runtime tracking
 * ever lands.
 */
export function RecentSubmissions({ recent }: RecentSubmissionsProps) {
    return (
        <Card className="p-5">
            <div className="flex items-center justify-between">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    Recent submissions
                </h2>
                <Link
                    href="/profile"
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                    See all →
                </Link>
            </div>

            {recent.length === 0 ? (
                <EmptyState
                    className="mt-3 border-none bg-transparent py-8"
                    icon={<History className="h-5 w-5" />}
                    title="No submissions yet"
                    description="Solve a problem and it will show up here."
                />
            ) : (
                <ul className="mt-2 divide-y divide-border">
                    {recent.map((s) => {
                        const accepted = s.status === "ACCEPTED"
                        const locked = Boolean(s.problem.contestLock)
                        const row = (
                            <div className="grid grid-cols-[1fr_120px_90px] items-center gap-3 py-2.5">
                                <span className="truncate text-sm font-medium text-foreground">
                                    <span className="mr-1 tabular-nums text-muted-foreground">
                                        {s.problem.number}.
                                    </span>
                                    {s.problem.title}
                                    {locked && (
                                        <span className="ml-2 text-[11px] font-normal text-warning">
                                            Locked
                                        </span>
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                        accepted
                                            ? "border-primary/20 bg-primary/10 text-primary"
                                            : "border-destructive/20 bg-destructive/10 text-destructive"
                                    )}
                                >
                                    {accepted ? (
                                        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                                    ) : (
                                        <XCircle className="h-3 w-3" aria-hidden="true" />
                                    )}
                                    {accepted ? "Accepted" : "Wrong answer"}
                                </span>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {formatRelative(s.createdAt)}
                                </span>
                            </div>
                        )
                        return (
                            <li key={s.id}>
                                {locked ? (
                                    <div className="opacity-70">{row}</div>
                                ) : (
                                    <Link
                                        href={`/practice/${s.problem.slug}`}
                                        className="-mx-2 block rounded-md px-2 transition-colors hover:bg-surface-hover"
                                    >
                                        {row}
                                    </Link>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
        </Card>
    )
}
