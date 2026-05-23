import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { Card, CardContent } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { StatusPill } from "@/components/ui/StatusPill"
import { TagCreateForm } from "@/components/admin/TagCreateForm"

export const metadata = {
    title: "Tags",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function TagsPage() {
    await requireAdminPage()

    const tags = await prisma.tag.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { problems: true, articles: true } } },
    })

    return (
        <AdminListShell
            eyebrow="TAGS"
            title="Tags"
            description={
                <>
                    {tags.length} total · created on the fly via the problem
                    editor or{" "}
                    <code className="font-mono text-xs">
                        POST /api/admin/tags
                    </code>
                </>
            }
        >

            <div className="mb-6">
                <TagCreateForm />
            </div>

            {tags.length === 0 ? (
                <EmptyState
                    title="No tags yet"
                    description="Add tags directly in the problem editor — they'll show up here automatically."
                />
            ) : (
                <Card>
                    <CardContent className="p-5">
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {tags.map((t) => (
                                <div
                                    key={t.id}
                                    className="rounded-md border border-border bg-surface-muted/40 p-3"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="font-mono text-sm">
                                            {t.slug}
                                        </span>
                                        <StatusPill
                                            status={
                                                t.kind === "TOPIC"
                                                    ? "accepted"
                                                    : "pending"
                                            }
                                            label={t.kind.toLowerCase()}
                                        />
                                    </div>
                                    <div className="mt-2 flex gap-3 font-mono text-[11px] tabular-nums text-muted-foreground">
                                        <span>{t._count.problems} problems</span>
                                        <span>{t._count.articles} articles</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </AdminListShell>
    )
}
