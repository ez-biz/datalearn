import { NextResponse } from "next/server"
import { Prisma, type ModeratorPermissionKey, type UserRole } from "@prisma/client"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ModeratorPermissionUpdateInput } from "@/lib/admin-validation"

const ModeratorCreateInput = ModeratorPermissionUpdateInput.extend({
    userId: z.string().min(1),
})

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

const candidateSelect = {
    id: true,
    email: true,
    name: true,
    image: true,
    role: true,
    createdAt: true,
} satisfies Prisma.UserSelect

export const GET = withAdmin(async (req) => {
    const url = new URL(req.url)
    const q = url.searchParams.get("q")?.trim() ?? ""

    const moderators = await prisma.user.findMany({
        where: { role: "MODERATOR" },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "asc" }],
        select: moderatorSelect,
    })

    const candidates = q
        ? await prisma.user.findMany({
              where: {
                  role: "USER",
                  OR: [
                      { email: { contains: q, mode: "insensitive" } },
                      { name: { contains: q, mode: "insensitive" } },
                  ],
              },
              orderBy: [{ role: "asc" }, { createdAt: "asc" }],
              take: 20,
              select: candidateSelect,
          })
        : []

    return NextResponse.json({ data: { moderators, candidates } })
})

export const POST = withAdmin(async (req, principal) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModeratorCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const { userId, permissions } = parsed.data
    const result = await prisma.$transaction(async (tx) => {
        const target = await lockUserForModeratorUpdate(tx, userId)
        if (!target) {
            return { error: "User not found.", status: 404 as const }
        }
        if (target.role !== "USER") {
            return {
                error:
                    target.role === "CONTRIBUTOR"
                        ? "Contributors cannot be added as moderators until roles are modeled separately. Change the role explicitly through the users API first."
                        : "Only USER accounts can be promoted through the moderator add flow.",
                status: 403 as const,
            }
        }

        const existingPermissions = await tx.moderatorPermission.findMany({
            where: { userId },
            select: { permission: true },
        })

        await tx.user.update({
            where: { id: userId },
            data: { role: "MODERATOR" },
            select: { id: true },
        })
        await replaceModeratorPermissions(tx, {
            userId,
            actorId: principal.userId,
            before: existingPermissions.map((p) => p.permission),
            after: permissions,
            logNoDelta:
                permissions.length === 0
                    ? "Granted moderator role with no permissions."
                    : null,
        })
        return { data: { id: userId } }
    })

    if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const moderator = await prisma.user.findUniqueOrThrow({
        where: { id: result.data.id },
        select: moderatorSelect,
    })

    return NextResponse.json({ data: moderator }, { status: 201 })
})

async function replaceModeratorPermissions(
    tx: Prisma.TransactionClient,
    {
        userId,
        actorId,
        before,
        after,
        logNoDelta,
    }: {
        userId: string
        actorId: string
        before: ModeratorPermissionKey[]
        after: ModeratorPermissionKey[]
        logNoDelta: string | null
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

    if (logs.length === 0 && logNoDelta) {
        logs.push({
            actorId,
            action: "GRANT_MODERATOR_PERMISSION",
            targetType: "USER",
            targetId: userId,
            note: logNoDelta,
        })
    }

    if (logs.length > 0) {
        await tx.discussionModerationLog.createMany({ data: logs })
    }
}

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
