import Link from "next/link"
import { Plus } from "lucide-react"
import type { ProblemStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ScrollableTable } from "@/components/ui/ScrollableTable"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"
import { ProblemRowActions } from "@/components/admin/ProblemRowActions"

export const dynamic = "force-dynamic"

export default async function AdminProblemsPage() {
    await requireAdminPage()

    const problems = await prisma.sQLProblem.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            schema: { select: { name: true } },
            tags: { select: { id: true, name: true, slug: true } },
            _count: { select: { submissions: true } },
        },
    })

    return (
        <AdminListShell
            eyebrow="PROBLEMS"
            title="Problems"
            description={
                <>
                    {problems.length} total · all changes go through{" "}
                    <code className="font-mono text-xs">/api/admin/problems</code>
                </>
            }
            actions={
                <LinkButton href="/admin/problems/new">
                    <Plus className="h-4 w-4" />
                    New problem
                </LinkButton>
            }
        >

            {problems.length === 0 ? (
                <EmptyState
                    title="No problems yet"
                    description="Create your first SQL practice problem."
                    action={
                        <LinkButton href="/admin/problems/new" size="sm">
                            <Plus className="h-4 w-4" />
                            New problem
                        </LinkButton>
                    }
                />
            ) : (
                <ScrollableTable>
                    <Card className="min-w-[960px] overflow-hidden">
                        <div className="hidden md:grid grid-cols-[4.5rem_1fr_8rem_8rem_1fr_1fr_6rem_3rem] items-center gap-4 px-5 py-3 border-b border-border bg-surface-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                            <span>#</span>
                            <span>Title</span>
                            <span>Status</span>
                            <span>Difficulty</span>
                            <span>Schema</span>
                            <span>Tags</span>
                            <span className="text-right tabular-nums">Submissions</span>
                            <span><span className="sr-only">Actions</span></span>
                        </div>
                        <ul className="divide-y divide-border">
                            {problems.map((p) => (
                                <li
                                    key={p.id}
                                    className="grid grid-cols-1 md:grid-cols-[4.5rem_1fr_8rem_8rem_1fr_1fr_6rem_3rem] items-center gap-4 px-5 py-3"
                                >
                                    <div className="hidden font-mono text-[11px] tabular-nums text-muted-foreground md:block">
                                        #{String(p.number).padStart(3, "0")}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/problems/${p.slug}/edit`}
                                                className="font-medium hover:text-primary transition-colors truncate"
                                            >
                                                <span className="mr-1 font-mono text-[11px] font-normal tabular-nums text-muted-foreground md:hidden">
                                                    #{String(p.number).padStart(3, "0")}
                                                </span>
                                                {p.title}
                                            </Link>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            /{p.slug}
                                        </p>
                                    </div>
                                    <StatusBadge status={p.status} />
                                    <div>
                                        <DifficultyBadge difficulty={p.difficulty} />
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                        {p.schema.name}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {p.tags.length === 0 ? (
                                            <span className="text-xs text-muted-foreground italic">
                                                none
                                            </span>
                                        ) : (
                                            p.tags.slice(0, 3).map((t) => (
                                                <Badge key={t.id} variant="secondary">
                                                    {t.slug}
                                                </Badge>
                                            ))
                                        )}
                                        {p.tags.length > 3 && (
                                            <span className="text-xs text-muted-foreground self-center">
                                                +{p.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground tabular-nums text-right">
                                        {p._count.submissions}
                                    </div>
                                    <ProblemRowActions
                                        slug={p.slug}
                                        title={p.title}
                                    />
                                </li>
                            ))}
                        </ul>
                    </Card>
                </ScrollableTable>
            )}
        </AdminListShell>
    )
}

function StatusBadge({ status }: { status: ProblemStatus }) {
    const map: Record<ProblemStatus, { pill: StatusPillStatus; label: string }> = {
        DRAFT: { pill: "draft", label: "draft" },
        BETA: { pill: "pending", label: "beta" },
        PUBLISHED: { pill: "accepted", label: "published" },
        ARCHIVED: { pill: "rejected", label: "archived" },
    }
    const { pill, label } = map[status]
    return <StatusPill status={pill} label={label} />
}
