import Link from "next/link"
import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ProblemRowActions } from "@/components/admin/ProblemRowActions"

export const dynamic = "force-dynamic"

export default async function AdminProblemsPage() {
    const problems = await prisma.sQLProblem.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            schema: { select: { name: true } },
            tags: { select: { id: true, name: true, slug: true } },
            _count: { select: { submissions: true } },
        },
    })

    return (
        <Container width="xl" className="py-10">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        Problems
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {problems.length} total · all changes go through{" "}
                        <code className="font-mono text-xs">/api/admin/problems</code>
                    </p>
                </div>
                <LinkButton href="/admin/problems/new">
                    <Plus className="h-4 w-4" />
                    New problem
                </LinkButton>
            </header>

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
                <Card className="overflow-hidden">
                    <div className="hidden md:grid grid-cols-[3.5rem_1fr_8rem_1fr_1fr_6rem_3rem] items-center gap-4 px-5 py-3 border-b border-border bg-surface-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                        <span>#</span>
                        <span>Title</span>
                        <span>Difficulty</span>
                        <span>Schema</span>
                        <span>Tags</span>
                        <span className="text-right tabular-nums">Submissions</span>
                        <span className="sr-only">Actions</span>
                    </div>
                    <ul className="divide-y divide-border">
                        {problems.map((p) => (
                            <li
                                key={p.id}
                                className="grid grid-cols-1 md:grid-cols-[3.5rem_1fr_8rem_1fr_1fr_6rem_3rem] items-center gap-4 px-5 py-3"
                            >
                                <div className="hidden md:block text-sm tabular-nums text-muted-foreground">
                                    {p.number}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <Link
                                            href={`/admin/problems/${p.slug}/edit`}
                                            className="font-medium hover:text-primary transition-colors truncate"
                                        >
                                            <span className="md:hidden text-muted-foreground tabular-nums font-normal mr-1">
                                                {p.number}.
                                            </span>
                                            {p.title}
                                        </Link>
                                        {p.status !== "PUBLISHED" && (
                                            <Badge variant="secondary" className="normal-case tracking-normal">
                                                {p.status.toLowerCase()}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-mono truncate">
                                        /{p.slug}
                                    </p>
                                </div>
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
            )}
        </Container>
    )
}
