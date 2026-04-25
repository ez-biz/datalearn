import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

type Ctx = { params: Promise<{ id: string }> }

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { id } = await ctx.params
    try {
        await prisma.apiKey.update({
            where: { id },
            data: { revokedAt: new Date() },
        })
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        if (e?.code === "P2025") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        console.error("Revoke API key failed:", e)
        return NextResponse.json(
            { error: "Failed to revoke key." },
            { status: 500 }
        )
    }
})
