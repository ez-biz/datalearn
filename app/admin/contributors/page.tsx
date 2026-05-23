import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { LinkButton } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { ContributorsClient } from "@/components/admin/ContributorsClient"

export const metadata = {
    title: "Contributors",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function ContributorsPage() {
    await requireAdminPage()

    const users = await prisma.user.findMany({
        orderBy: [{ role: "desc" }, { createdAt: "asc" }],
        take: 200,
        select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            createdAt: true,
            _count: { select: { articles: true } },
        },
    })

    const adminCount = users.filter((u) => u.role === "ADMIN").length
    const moderatorCount = users.filter((u) => u.role === "MODERATOR").length
    const contributorCount = users.filter((u) => u.role === "CONTRIBUTOR").length
    const userCount = users.filter((u) => u.role === "USER").length

    return (
        <AdminListShell
            eyebrow="CONTRIBUTORS"
            title="Contributors"
            description={
                <>
                    <p>
                        {adminCount} admin · {moderatorCount} moderator ·{" "}
                        {contributorCount} contributor · {userCount} user —
                        promote/revoke contributors via{" "}
                        <code className="font-mono text-xs">
                            PATCH /api/admin/users/[id]
                        </code>
                    </p>
                    <p className="mt-2 text-xs">
                        ADMIN changes stay DB-only. Moderator permissions are managed
                        from the dedicated moderator page.
                    </p>
                </>
            }
            actions={
                <LinkButton
                    href="/admin/moderators"
                    variant="outline"
                    className="shrink-0"
                >
                    Manage moderators
                </LinkButton>
            }
        >

            <Card>
                <CardContent className="p-5">
                    <ContributorsClient initialUsers={users} />
                </CardContent>
            </Card>
        </AdminListShell>
    )
}
