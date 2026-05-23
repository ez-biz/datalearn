import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import type { ArticleStatus } from "@prisma/client"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { EmptyState } from "@/components/ui/EmptyState"
import { ScrollableTable } from "@/components/ui/ScrollableTable"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"
import { ArticleRowActions } from "@/components/admin/ArticleRowActions"
import { ArticleStatusTabs } from "@/components/admin/ArticleStatusTabs"

export const metadata = {
    title: "Articles",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

const ALLOWED_STATUS = new Set<ArticleStatus>([
    "DRAFT",
    "SUBMITTED",
    "PUBLISHED",
    "ARCHIVED",
])

export default async function AdminArticlesPage({
    searchParams,
}: {
    searchParams: Promise<{ status?: string }>
}) {
    await requireAdminPage()

    const sp = await searchParams
    const filterStatus =
        sp.status && ALLOWED_STATUS.has(sp.status as ArticleStatus)
            ? (sp.status as ArticleStatus)
            : null

    const [articles, counts] = await Promise.all([
        prisma.article.findMany({
            where: filterStatus ? { status: filterStatus } : undefined,
            orderBy: { updatedAt: "desc" },
            include: {
                topic: { select: { slug: true, name: true } },
                tags: { select: { id: true, slug: true } },
                author: { select: { id: true, name: true, email: true } },
            },
        }),
        prisma.article.groupBy({
            by: ["status"],
            _count: { _all: true },
        }),
    ])

    const total = counts.reduce((n, c) => n + c._count._all, 0)
    const countMap = Object.fromEntries(
        counts.map((c) => [c.status, c._count._all])
    ) as Partial<Record<ArticleStatus, number>>

    return (
        <AdminListShell
            eyebrow="ARTICLES"
            title="Articles"
            description={
                <>
                    {total} total · all changes go through{" "}
                    <code className="font-mono text-xs">/api/admin/articles</code>
                </>
            }
            actions={
                <LinkButton href="/admin/articles/new">
                    <Plus className="h-4 w-4" />
                    New article
                </LinkButton>
            }
        >

            <ArticleStatusTabs total={total} counts={countMap} active={filterStatus} />

            {articles.length === 0 ? (
                <EmptyState
                    title="Nothing here"
                    description={
                        filterStatus
                            ? `No articles with status "${filterStatus.toLowerCase()}".`
                            : "Create your first article."
                    }
                    action={
                        <LinkButton href="/admin/articles/new" size="sm">
                            <Plus className="h-4 w-4" />
                            New article
                        </LinkButton>
                    }
                />
            ) : (
                <ScrollableTable>
                    <Card className="min-w-[900px] overflow-hidden">
                        <div className="hidden md:grid grid-cols-[1fr_8rem_8rem_1fr_8rem_3rem] items-center gap-4 px-5 py-3 border-b border-border bg-surface-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                            <span>Title</span>
                            <span>Status</span>
                            <span>Topic</span>
                            <span>Tags</span>
                            <span>Author</span>
                            <span className="sr-only">Actions</span>
                        </div>
                        <ul className="divide-y divide-border">
                            {articles.map((a) => (
                                <li
                                    key={a.id}
                                    className="grid grid-cols-1 md:grid-cols-[1fr_8rem_8rem_1fr_8rem_3rem] items-center gap-4 px-5 py-3"
                                >
                                    <div className="min-w-0">
                                        {a.hasVisualBlocks && (
                                            <Eyebrow className="mb-1">
                                                VISUAL
                                            </Eyebrow>
                                        )}
                                        <Link
                                            href={`/admin/articles/${a.slug}/edit`}
                                            className="font-medium hover:text-primary truncate block"
                                        >
                                            {a.title}
                                        </Link>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            /{a.slug}
                                        </p>
                                    </div>
                                    <div>
                                        <StatusBadge status={a.status} />
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                        {a.topic.name}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {a.tags.length === 0 ? (
                                            <span className="text-xs text-muted-foreground italic">
                                                none
                                            </span>
                                        ) : (
                                            a.tags.slice(0, 3).map((t) => (
                                                <Badge key={t.id} variant="secondary">
                                                    {t.slug}
                                                </Badge>
                                            ))
                                        )}
                                        {a.tags.length > 3 && (
                                            <span className="text-xs text-muted-foreground self-center">
                                                +{a.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground truncate">
                                        {a.author?.name ?? a.author?.email ?? "—"}
                                    </div>
                                    <ArticleRowActions slug={a.slug} title={a.title} />
                                </li>
                            ))}
                        </ul>
                    </Card>
                </ScrollableTable>
            )}
        </AdminListShell>
    )
}

function StatusBadge({ status }: { status: ArticleStatus }) {
    const map: Record<ArticleStatus, { pill: StatusPillStatus; label: string }> = {
        DRAFT: { pill: "draft", label: "draft" },
        SUBMITTED: { pill: "pending", label: "review" },
        PUBLISHED: { pill: "accepted", label: "published" },
        ARCHIVED: { pill: "rejected", label: "archived" },
    }
    const { pill, label } = map[status]
    return <StatusPill status={pill} label={label} />
}
