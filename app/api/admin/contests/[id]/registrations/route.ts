import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { id: contestId } = await ctx.params
    const rows = await prisma.contestRegistration.findMany({
        where: { contestId },
        orderBy: { registeredAt: "asc" },
        include: { user: { select: { id: true, email: true, name: true } } },
    })
    return NextResponse.json({ data: rows, count: rows.length })
})
