import { NextResponse } from "next/server"
import { Prisma, type ModeratorPermissionKey, type UserRole } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ModeratorPermissionUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ id: string }> }

const moderatorSelect = {
    id: true,
    email: true,
    name: true,
    image: true,
    role: true,
    createdAt: true,
    moderatorPermissions: {
        orderBy: { permission: "asc" as const },
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
} satisfies Prisma.UserSelect

export const PATCH = withAdmin(async (req, principal, ctx: Ctx) => {
    const { id } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModeratorPermissionUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const result = await prisma.$transaction(async (tx) => {
        const target = await lockUserForModeratorUpdate(tx, id)
        if (!target) {
            return { error: "User not found.", status: 404 as const }
        }
        if (target.role === "ADMIN") {
            return {
                error: "ADMIN users cannot be managed as moderators.",
                status: 403 as const,
            }
        }
        if (target.role !== "MODERATOR") {
            return { error: "User is not a moderator.", status: 409 as const }
        }

        const existingPermissions = await tx.moderatorPermission.findMany({
            where: { userId: id },
            select: { permission: true },
        })

        await replaceModeratorPermissions(tx, {
            userId: id,
            actorId: principal.userId,
            before: existingPermissions.map((p) => p.permission),
            after: parsed.data.permissions,
        })
        return { data: { id } }
    })

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const moderator = await prisma.user.findUniqueOrThrow({
        where: { id: result.data.id },
        select: moderatorSelect,
    })

    return NextResponse.json({ data: moderator })
})

export const DELETE = withAdmin(async (_req, principal, ctx: Ctx) => {
    const { id } = await ctx.params
    const result = await prisma.$transaction(async (tx) => {
        const target = await lockUserForModeratorUpdate(tx, id)
        if (!target) {
            return { error: "User not found.", status: 404 as const }
        }
        if (target.role === "ADMIN") {
            return {
                error: "ADMIN users cannot be demoted through this flow.",
                status: 403 as const,
            }
        }
        if (target.role !== "MODERATOR") {
            return { error: "User is not a moderator.", status: 409 as const }
        }

        const existingPermissions = await tx.moderatorPermission.findMany({
            where: { userId: id },
            select: { permission: true },
        })

        await tx.moderatorPermission.deleteMany({ where: { userId: id } })
        await tx.user.update({
            where: { id },
            data: { role: "USER" },
            select: { id: true },
        })

        const permissions = existingPermissions.map((p) => p.permission)
        const logs =
            permissions.length > 0
                ? permissions.map((permission) => ({
                      actorId: principal.userId,
                      action: "REVOKE_MODERATOR_PERMISSION" as const,
                      targetType: "USER",
                      targetId: id,
                      note: `Revoked ${permission}.`,
                  }))
                : [
                      {
                          actorId: principal.userId,
                          action: "REVOKE_MODERATOR_PERMISSION" as const,
                          targetType: "USER",
                          targetId: id,
                          note: "Revoked moderator role with no permissions.",
                      },
                  ]

        await tx.discussionModerationLog.createMany({ data: logs })
        return { data: { id, role: "USER" as const } }
    })

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({ data: result.data })
})

type LockedUser = {
    id: string
    role: UserRole
}

async function lockUserForModeratorUpdate(
    tx: Prisma.TransactionClient,
    id: string
): Promise<LockedUser | null> {
    const rows = await tx.$queryRaw<LockedUser[]>(Prisma.sql`
        SELECT "id", "role"
        FROM "User"
        WHERE "id" = ${id}
        FOR UPDATE
    `)
    return rows[0] ?? null
}

async function replaceModeratorPermissions(
    tx: Prisma.TransactionClient,
    {
        userId,
        actorId,
        before,
        after,
    }: {
        userId: string
        actorId: string
        before: ModeratorPermissionKey[]
        after: ModeratorPermissionKey[]
    }
) {
    const beforeSet = new Set(before)
    const afterSet = new Set(after)
    const added = after.filter((permission) => !beforeSet.has(permission))
    const removed = before.filter((permission) => !afterSet.has(permission))

    await tx.moderatorPermission.deleteMany({ where: { userId } })
    if (after.length > 0) {
        await tx.moderatorPermission.createMany({
            data: after.map((permission) => ({
                userId,
                permission,
                grantedById: actorId,
            })),
        })
    }

    const logs = [
        ...added.map((permission) => ({
            actorId,
            action: "GRANT_MODERATOR_PERMISSION" as const,
            targetType: "USER",
            targetId: userId,
            note: `Granted ${permission}.`,
        })),
        ...removed.map((permission) => ({
            actorId,
            action: "REVOKE_MODERATOR_PERMISSION" as const,
            targetType: "USER",
            targetId: userId,
            note: `Revoked ${permission}.`,
        })),
    ]

    if (logs.length > 0) {
        await tx.discussionModerationLog.createMany({ data: logs })
    }
}
