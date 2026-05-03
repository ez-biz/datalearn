import { NextResponse } from "next/server"
import { Prisma, type ModeratorPermissionKey } from "@prisma/client"
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
                  role: { in: ["USER", "CONTRIBUTOR"] },
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
    const target = await prisma.user.findUnique({
        where: { id: userId },
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

    await prisma.$transaction(async (tx) => {
        await tx.user.update({
            where: { id: userId },
            data: { role: "MODERATOR" },
            select: { id: true },
        })
        await replaceModeratorPermissions(tx, {
            userId,
            actorId: principal.userId,
            before: target.moderatorPermissions.map((p) => p.permission),
            after: permissions,
            logNoDelta:
                target.role !== "MODERATOR" && permissions.length === 0
                    ? "Granted moderator role with no permissions."
                    : null,
        })
    })

    const moderator = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
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
