import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import type { ArticleStatus } from "@prisma/client"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
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
        <Container width="xl" className="py-10">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Articles
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {total} total · all changes go through{" "}
                        <code className="font-mono text-xs">/api/admin/articles</code>
                    </p>
                </div>
                <LinkButton href="/admin/articles/new">
                    <Plus className="h-4 w-4" />
                    New article
                </LinkButton>
            </header>

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
                <Card className="overflow-hidden">
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
            )}
        </Container>
    )
}

function StatusBadge({ status }: { status: ArticleStatus }) {
    const map: Record<ArticleStatus, { variant: "primary" | "secondary" | "accent"; label: string }> = {
        DRAFT: { variant: "secondary", label: "Draft" },
        SUBMITTED: { variant: "accent", label: "In review" },
        PUBLISHED: { variant: "primary", label: "Published" },
        ARCHIVED: { variant: "secondary", label: "Archived" },
    }
    const { variant, label } = map[status]
    return (
        <Badge variant={variant} className="normal-case tracking-normal">
            {label}
        </Badge>
    )
}
