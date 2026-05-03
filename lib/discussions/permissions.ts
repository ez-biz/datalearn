import { prisma } from "@/lib/prisma"
import type { ModeratorPermissionKey, UserRole } from "@prisma/client"

export async function userHasDiscussionPermission(
    user: { id: string; role: UserRole },
    permission: ModeratorPermissionKey
): Promise<boolean> {
    if (user.role === "ADMIN") return true
    if (user.role !== "MODERATOR") return false

    const row = await prisma.moderatorPermission.findUnique({
        where: { userId_permission: { userId: user.id, permission } },
        select: { userId: true },
    })
    return Boolean(row)
}

export async function listModeratorPermissions(
    userId: string
): Promise<ModeratorPermissionKey[]> {
    const rows = await prisma.moderatorPermission.findMany({
        where: { userId },
        select: { permission: true },
        orderBy: { permission: "asc" },
    })
    return rows.map((r) => r.permission)
}
