import { ShieldCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { ModeratorsClient } from "@/components/admin/ModeratorsClient"

export const metadata = {
    title: "Moderators",
    robots: { index: false, follow: false },
}
export const dynamic = "force-dynamic"

export default async function ModeratorsPage() {
    await requireAdminPage()

    const moderators = await prisma.user.findMany({
        where: { role: "MODERATOR" },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
        select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
            createdAt: true,
            moderatorPermissions: {
                orderBy: { permission: "asc" },
                select: {
                    permission: true,
                    createdAt: true,
                    grantedBy: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                        },
                    },
                },
            },
        },
    })

    const permissionCount = moderators.reduce(
        (count, moderator) => count + moderator.moderatorPermissions.length,
        0
    )

    return (
        <Container width="xl" className="py-10">
            <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Moderator management
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Review discussion moderators, replace permission sets, and
                        revoke moderator access.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                        ADMIN users are intentionally excluded from this flow.
                    </p>
                </div>
                <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="tabular-nums">{moderators.length}</span>{" "}
                    moderators ·{" "}
                    <span className="tabular-nums">{permissionCount}</span>{" "}
                    permissions
                </div>
            </header>

            <ModeratorsClient
                initialModerators={moderators.map((moderator) => ({
                    ...moderator,
                    role: "MODERATOR" as const,
                }))}
            />
        </Container>
    )
}
