import { NextResponse } from "next/server"
import { Prisma, type ModeratorPermissionKey, type UserRole } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { UserRoleUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ id: string }> }

/**
 * Change a user's role. Restrictions:
 * - You cannot promote-to or demote-from ADMIN through this endpoint.
 *   Use psql for that — done deliberately so an admin can't lock themselves
 *   out via the UI.
 * - Moving a MODERATOR back to USER/CONTRIBUTOR clears moderator permissions.
 * - Moving a USER/CONTRIBUTOR to MODERATOR grants the role with no permissions;
 *   assign permissions from /admin/moderators.
 *
 * Allowed transitions: USER, CONTRIBUTOR, and MODERATOR.
 */
export const PATCH = withAdmin(async (req, principal, ctx: Ctx) => {
    const { id } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = UserRoleUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const { role: newRole } = parsed.data

    if (newRole === "ADMIN") {
        return NextResponse.json(
            { error: "Promote to ADMIN via the database, not the UI." },
            { status: 403 }
        )
    }

    const result = await prisma.$transaction(async (tx) => {
        const target = await lockUserForRoleUpdate(tx, id)
        if (!target) {
            return { error: "User not found.", status: 404 as const }
        }
        if (target.role === "ADMIN") {
            return {
                error: "Demote ADMINs via the database, not the UI.",
                status: 403 as const,
            }
        }
        if (target.id === principal.userId) {
            return {
                error: "You cannot change your own role.",
                status: 403 as const,
            }
        }
        if (target.role === newRole) {
            return { data: target }
        }

        const existingPermissions = await tx.moderatorPermission.findMany({
            where: { userId: id },
            select: { permission: true },
        })
        const permissions = existingPermissions.map((p) => p.permission)

        if (target.role === "MODERATOR" && newRole !== "MODERATOR") {
            await tx.moderatorPermission.deleteMany({ where: { userId: id } })
            await tx.discussionModerationLog.createMany({
                data: buildModeratorRoleRevokeLogs({
                    actorId: principal.userId,
                    targetId: id,
                    permissions,
                    newRole,
                }),
            })
        }

        if (target.role !== "MODERATOR" && newRole === "MODERATOR") {
            await tx.discussionModerationLog.create({
                data: {
                    actorId: principal.userId,
                    action: "GRANT_MODERATOR_PERMISSION",
                    targetType: "USER",
                    targetId: id,
                    note: "Granted moderator role with no permissions.",
                },
            })
        }

        const updated = await tx.user.update({
            where: { id },
            data: { role: newRole },
            select: { id: true, role: true, email: true, name: true },
        })
        return { data: updated }
    })

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
})

type LockedUser = {
    id: string
    role: UserRole
    email: string | null
    name: string | null
}

async function lockUserForRoleUpdate(
    tx: Prisma.TransactionClient,
    id: string
): Promise<LockedUser | null> {
    const rows = await tx.$queryRaw<LockedUser[]>(Prisma.sql`
        SELECT "id", "role", "email", "name"
        FROM "User"
        WHERE "id" = ${id}
        FOR UPDATE
    `)
    return rows[0] ?? null
}

function buildModeratorRoleRevokeLogs({
    actorId,
    targetId,
    permissions,
    newRole,
}: {
    actorId: string
    targetId: string
    permissions: ModeratorPermissionKey[]
    newRole: Exclude<UserRole, "ADMIN">
}) {
    if (permissions.length === 0) {
        return [
            {
                actorId,
                action: "REVOKE_MODERATOR_PERMISSION" as const,
                targetType: "USER",
                targetId,
                note: `Revoked moderator role with no permissions; new role ${newRole}.`,
            },
        ]
    }

    return permissions.map((permission) => ({
        actorId,
        action: "REVOKE_MODERATOR_PERMISSION" as const,
        targetType: "USER",
        targetId,
        note: `Revoked ${permission}; new role ${newRole}.`,
    }))
}
