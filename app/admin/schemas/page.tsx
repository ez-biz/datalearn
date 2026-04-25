import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"

export const metadata = { title: "Schemas", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function SchemasPage() {
    const schemas = await prisma.sqlSchema.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { problems: true } } },
    })

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Schemas
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {schemas.length} total · managed via{" "}
                    <code className="font-mono text-xs">/api/admin/schemas</code>
                </p>
            </header>

            {schemas.length === 0 ? (
                <EmptyState
                    title="No schemas yet"
                    description="Create one inline when you create your first problem."
                    action={
                        <LinkButton href="/admin/problems/new" size="sm">
                            New problem
                        </LinkButton>
                    }
                />
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <ul className="divide-y divide-border">
                            {schemas.map((s) => (
                                <li key={s.id} className="px-5 py-4">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-medium">{s.name}</h3>
                                            <Badge variant="secondary">
                                                {s._count.problems}{" "}
                                                {s._count.problems === 1 ? "problem" : "problems"}
                                            </Badge>
                                        </div>
                                    </div>
                                    <details className="group">
                                        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                            Show DDL
                                        </summary>
                                        <pre className="mt-2 rounded-md border border-border bg-surface-muted px-3 py-2 text-[12px] leading-relaxed font-mono overflow-x-auto scrollbar-thin max-h-64">
                                            <code>{s.sql}</code>
                                        </pre>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </Container>
    )
}
