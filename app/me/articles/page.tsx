import Link from "next/link"
import { Plus } from "lucide-react"
import type { ArticleStatus } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { signInPath } from "@/lib/auth-redirect"
import { redirect } from "next/navigation"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { LinkButton } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

export const dynamic = "force-dynamic"

export default async function MyArticlesPage() {
    const session = await auth()
    if (!session?.user?.id) redirect(signInPath("/me/articles"))

    const articles = await prisma.article.findMany({
        where: { authorId: session.user.id },
        orderBy: { updatedAt: "desc" },
        include: {
            topic: { select: { name: true, slug: true } },
        },
    })

    return (
        <Container width="lg" className="py-10">
            <header className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                        My articles
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Drafts you&apos;re working on, articles you&apos;ve submitted
                        for review, and ones that have been published.
                    </p>
                </div>
                <LinkButton href="/me/articles/new">
                    <Plus className="h-4 w-4" />
                    New article
                </LinkButton>
            </header>

            {articles.length === 0 ? (
                <EmptyState
                    title="Nothing yet"
                    description="Start a draft. Submit it when you're ready, an admin will review."
                    action={
                        <LinkButton href="/me/articles/new" size="sm">
                            <Plus className="h-4 w-4" />
                            New article
                        </LinkButton>
                    }
                />
            ) : (
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-border">
                        {articles.map((a) => (
                            <li key={a.id}>
                                <Link
                                    href={`/me/articles/${a.slug}/edit`}
                                    className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_8rem] items-center gap-4 px-5 py-4 hover:bg-surface-muted/60 transition-colors group"
                                >
                                    <div className="min-w-0">
                                        <h3 className="font-medium group-hover:text-primary transition-colors truncate">
                                            {a.title || "(untitled draft)"}
                                        </h3>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            /{a.slug}
                                            {a.reviewNotes && a.status === "DRAFT" && (
                                                <span className="ml-2 text-medium-fg font-sans not-italic">
                                                    · feedback received
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                        {a.topic.name}
                                    </div>
                                    <div>
                                        <StatusBadge status={a.status} />
                                    </div>
                                </Link>
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
