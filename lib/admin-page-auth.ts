import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { ModeratorPermissionKey } from "@prisma/client"

export async function requireAdminPage() {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== "ADMIN") redirect("/")
    return session
}

export async function requireAdminOrModeratorPage(
    permission?: ModeratorPermissionKey
) {
    const session = await auth()
    if (!session?.user?.id) redirect("/")
    if (session.user.role === "ADMIN") return session
    if (session.user.role !== "MODERATOR") redirect("/")
    if (!permission) return session

    const ok = await prisma.moderatorPermission.findUnique({
        where: { userId_permission: { userId: session.user.id, permission } },
        select: { userId: true },
    })
    if (!ok) redirect("/")
    return session
}
