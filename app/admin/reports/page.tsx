import Link from "next/link"
import { Inbox } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ReportRowActions } from "@/components/admin/ReportRowActions"

export const metadata = {
    title: "Reports",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

const KIND_LABEL: Record<string, string> = {
    WRONG_ANSWER: "Wrong answer",
    UNCLEAR_DESCRIPTION: "Unclear description",
    BROKEN_SCHEMA: "Broken schema",
    TYPO: "Typo",
    OTHER: "Other",
}

// Cap how many rows we render. The DB can hold more — query directly if you
// need to triage past this. Two separate queries so a flood of resolved rows
// can't push open ones off the page.
const OPEN_LIMIT = 200
const RESOLVED_LIMIT = 100

export default async function AdminReportsPage() {
    await requireAdminPage()

    const [open, resolved] = await Promise.all([
        prisma.problemReport.findMany({
            where: { resolvedAt: null },
            orderBy: { createdAt: "desc" },
            take: OPEN_LIMIT,
            include: {
                problem: { select: { slug: true, title: true } },
                user: { select: { id: true, name: true, email: true } },
            },
        }),
        prisma.problemReport.findMany({
            where: { resolvedAt: { not: null } },
            orderBy: { resolvedAt: "desc" },
            take: RESOLVED_LIMIT,
            include: {
                problem: { select: { slug: true, title: true } },
                user: { select: { id: true, name: true, email: true } },
            },
        }),
    ])

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Reports
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {open.length} open · {resolved.length} resolved
                </p>
            </header>

            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Open
            </h2>
            {open.length === 0 ? (
                <EmptyState
                    icon={<Inbox className="h-5 w-5" />}
                    title="Nothing to triage"
                    description="When users hit Report on a problem, it shows up here."
                />
            ) : (
                <Card className="mb-8">
                    <CardContent className="p-0 divide-y divide-border">
                        {open.map((r) => (
                            <ReportRow
                                key={r.id}
                                id={r.id}
                                kind={r.kind}
                                kindLabel={KIND_LABEL[r.kind] ?? r.kind}
                                message={r.message}
                                createdAt={r.createdAt}
                                problemSlug={r.problem.slug}
                                problemTitle={r.problem.title}
                                reporter={
                                    r.user
                                        ? r.user.name ?? r.user.email ?? "user"
                                        : "anonymous"
                                }
                                resolved={false}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}

            {resolved.length > 0 && (
                <>
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Resolved
                    </h2>
                    <Card>
                        <CardContent className="p-0 divide-y divide-border">
                            {resolved.map((r) => (
                                <ReportRow
                                    key={r.id}
                                    id={r.id}
                                    kind={r.kind}
                                    kindLabel={KIND_LABEL[r.kind] ?? r.kind}
                                    message={r.message}
                                    createdAt={r.createdAt}
                                    resolvedAt={r.resolvedAt}
                                    problemSlug={r.problem.slug}
                                    problemTitle={r.problem.title}
                                    reporter={
                                        r.user
                                            ? r.user.name ?? r.user.email ?? "user"
                                            : "anonymous"
                                    }
                                    resolved
                                />
                            ))}
                        </CardContent>
                    </Card>
                </>
            )}
        </Container>
    )
}

function ReportRow({
    id,
    kind,
    kindLabel,
    message,
    createdAt,
    resolvedAt,
    problemSlug,
    problemTitle,
    reporter,
    resolved,
}: {
    id: string
    kind: string
    kindLabel: string
    message: string
    createdAt: Date
    resolvedAt?: Date | null
    problemSlug: string
    problemTitle: string
    reporter: string
    resolved: boolean
}) {
    return (
        <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-start gap-3">
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={kind === "WRONG_ANSWER" ? "primary" : "secondary"}>
                        {kindLabel}
                    </Badge>
                    <Link
                        href={`/practice/${problemSlug}`}
                        className="text-sm font-medium hover:text-primary truncate"
                    >
                        {problemTitle}
                    </Link>
                    <Link
                        href={`/admin/problems/${problemSlug}/edit`}
                        className="text-xs text-muted-foreground hover:text-foreground"
                    >
                        edit →
                    </Link>
                </div>
                <p className="text-sm whitespace-pre-wrap break-words">{message}</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                    by {reporter} · {fmt(createdAt)}
                    {resolvedAt && <> · resolved {fmt(resolvedAt)}</>}
                </p>
            </div>
            <ReportRowActions id={id} resolved={resolved} />
        </div>
    )
}

function fmt(d: Date | string): string {
    const t = typeof d === "string" ? new Date(d) : d
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
