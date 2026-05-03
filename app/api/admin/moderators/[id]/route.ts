import { NextResponse } from "next/server"
import { Prisma, type ModeratorPermissionKey } from "@prisma/client"
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

    const target = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            role: true,
            moderatorPermissions: { select: { permission: true } },
        },
    })

    if (!target) {
        return NextResponse.json({ error: "User not found." }, { status: 404 })
    }
    if (target.role === "ADMIN") {
        return NextResponse.json(
            { error: "ADMIN users cannot be managed as moderators." },
            { status: 403 }
        )
    }
    if (target.role !== "MODERATOR") {
        return NextResponse.json(
            { error: "User is not a moderator." },
            { status: 409 }
        )
    }

    await prisma.$transaction(async (tx) => {
        await replaceModeratorPermissions(tx, {
            userId: id,
            actorId: principal.userId,
            before: target.moderatorPermissions.map((p) => p.permission),
            after: parsed.data.permissions,
        })
    })

    const moderator = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: moderatorSelect,
    })

    return NextResponse.json({ data: moderator })
})

export const DELETE = withAdmin(async (_req, principal, ctx: Ctx) => {
    const { id } = await ctx.params
    const target = await prisma.user.findUnique({
        where: { id },
        select: {
            id: true,
            role: true,
            moderatorPermissions: { select: { permission: true } },
        },
    })

    if (!target) {
        return NextResponse.json({ error: "User not found." }, { status: 404 })
    }
    if (target.role === "ADMIN") {
        return NextResponse.json(
            { error: "ADMIN users cannot be demoted through this flow." },
            { status: 403 }
        )
    }
    if (target.role !== "MODERATOR") {
        return NextResponse.json(
            { error: "User is not a moderator." },
            { status: 409 }
        )
    }

    await prisma.$transaction(async (tx) => {
        await tx.moderatorPermission.deleteMany({ where: { userId: id } })
        await tx.user.update({
            where: { id },
            data: { role: "USER" },
            select: { id: true },
        })

        const permissions = target.moderatorPermissions.map((p) => p.permission)
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
    })

    return NextResponse.json({ data: { id, role: "USER" } })
})

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
