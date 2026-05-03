import { NextResponse } from "next/server"
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
    const target = await prisma.user.findUnique({
        where: { id },
        select: { id: true, role: true, email: true, name: true },
    })
    if (!target) {
        return NextResponse.json({ error: "User not found." }, { status: 404 })
    }
    if (target.role === "ADMIN") {
        return NextResponse.json(
            { error: "Demote ADMINs via the database, not the UI." },
            { status: 403 }
        )
    }
    if (target.id === principal.userId) {
        return NextResponse.json(
            { error: "You cannot change your own role." },
            { status: 403 }
        )
    }
    if (target.role === newRole) {
        return NextResponse.json({ data: target })
    }

    const updated = await prisma.$transaction(async (tx) => {
        if (target.role === "MODERATOR" && newRole !== "MODERATOR") {
            await tx.moderatorPermission.deleteMany({ where: { userId: id } })
        }

        return tx.user.update({
            where: { id },
            data: { role: newRole },
            select: { id: true, role: true, email: true, name: true },
        })
    })
    return NextResponse.json({ data: updated })
})
