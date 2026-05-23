import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { CodeBlock } from "@/components/ui/CodeBlock"

export const metadata = { title: "Schemas", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

export default async function SchemasPage() {
    await requireAdminPage()

    const schemas = await prisma.sqlSchema.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { problems: true } } },
    })

    return (
        <AdminListShell
            eyebrow="SCHEMAS"
            title="Schemas"
            description={
                <>
                    {schemas.length} total · managed via{" "}
                    <code className="font-mono text-xs">/api/admin/schemas</code>
                </>
            }
        >

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
                                        <CodeBlock language="sql">{s.sql}</CodeBlock>
                                    </details>
                                </li>
                            ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </AdminListShell>
    )
}
