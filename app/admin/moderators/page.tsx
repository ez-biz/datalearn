import { ShieldCheck } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { StatusPill } from "@/components/ui/StatusPill"
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
        <AdminListShell
            eyebrow="MODERATORS"
            title="Moderator management"
            description={
                <>
                    <p>
                        Review discussion moderators, replace permission sets, and
                        revoke moderator access.
                    </p>
                    <p className="mt-2 text-xs">
                        ADMIN, CONTRIBUTOR, and existing MODERATOR accounts are
                        intentionally excluded from the add flow.
                    </p>
                </>
            }
            actions={
                <div className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <StatusPill
                        status="accepted"
                        label={`${moderators.length} moderators`}
                    />
                    <span className="font-mono text-[11px] tabular-nums">
                        {permissionCount} permissions
                    </span>
                </div>
            }
        >

            <ModeratorsClient
                initialModerators={moderators.map((moderator) => ({
                    ...moderator,
                    role: "MODERATOR" as const,
                }))}
            />
        </AdminListShell>
    )
}
