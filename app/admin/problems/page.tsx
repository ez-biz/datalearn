import { Plus } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { LinkButton } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { ProblemsListClient } from "@/components/admin/ProblemsListClient"

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
                <ProblemsListClient problems={problems} />
            )}
        </AdminListShell>
    )
}
