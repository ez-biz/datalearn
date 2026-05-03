import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { TopicNewForm } from "@/components/admin/TopicNewForm"
import { TopicRowActions } from "@/components/admin/TopicRowActions"

export const metadata = {
    title: "Topics",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function TopicsPage() {
    await requireAdminPage()

    const topics = await prisma.topic.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { articles: true } } },
    })

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Topics
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {topics.length} total · managed via{" "}
                    <code className="font-mono text-xs">/api/admin/topics</code>
                </p>
            </header>

            <Card className="mb-6">
                <CardContent className="p-5">
                    <h2 className="text-sm font-semibold mb-3">Create topic</h2>
                    <TopicNewForm />
                </CardContent>
            </Card>

            {topics.length === 0 ? (
                <EmptyState
                    title="No topics yet"
                    description="Create one above to start grouping articles."
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <ul className="divide-y divide-border">
                            {topics.map((t) => (
                                <li
                                    key={t.id}
                                    className="px-5 py-3 flex items-center gap-3"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Link
                                                href={`/admin/topics/${t.slug}/edit`}
                                                className="font-medium hover:text-primary truncate"
                                            >
                                                {t.name}
                                            </Link>
                                            <Badge variant="secondary">
                                                {t._count.articles}{" "}
                                                {t._count.articles === 1 ? "article" : "articles"}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            /{t.slug}
                                        </p>
                                        {t.description && (
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                                {t.description}
                                            </p>
                                        )}
                                    </div>
                                    <TopicRowActions
                                        slug={t.slug}
                                        name={t.name}
                                        articleCount={t._count.articles}
                                    />
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </Container>
    )
}
