import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
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
    const contributorCount = users.filter((u) => u.role === "CONTRIBUTOR").length
    const userCount = users.filter((u) => u.role === "USER").length

    return (
        <Container width="lg" className="py-10">
            <header className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                    Contributors
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    {adminCount} admin · {contributorCount} contributor ·{" "}
                    {userCount} user — promote/revoke via{" "}
                    <code className="font-mono text-xs">
                        PATCH /api/admin/users/[id]
                    </code>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                    ADMIN promotion is gated behind direct DB access on purpose.
                    Use psql to grant or revoke ADMIN.
                </p>
            </header>

            <Card>
                <CardContent className="p-5">
                    <ContributorsClient initialUsers={users} />
                </CardContent>
            </Card>
        </Container>
    )
}
