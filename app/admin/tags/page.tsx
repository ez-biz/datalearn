import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

export const metadata = { title: "Tags", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function TagsPage() {
    const tags = await prisma.tag.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { problems: true } } },
    })

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Tags
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {tags.length} total · created on the fly via the problem editor or{" "}
                    <code className="font-mono text-xs">POST /api/admin/tags</code>
                </p>
            </header>

            {tags.length === 0 ? (
                <EmptyState
                    title="No tags yet"
                    description="Add tags directly in the problem editor — they'll show up here automatically."
                />
            ) : (
                <Card>
                    <CardContent className="p-5">
                        <div className="flex flex-wrap gap-2">
                            {tags.map((t) => (
                                <Badge
                                    key={t.id}
                                    variant="secondary"
                                    className="normal-case tracking-normal text-xs"
                                >
                                    {t.slug}
                                    <span className="ml-1 tabular-nums text-muted-foreground">
                                        {t._count.problems}
                                    </span>
                                </Badge>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </Container>
    )
}
