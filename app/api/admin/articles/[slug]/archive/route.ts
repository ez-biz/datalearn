import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

type Ctx = { params: Promise<{ slug: string }> }

/**
 * Archive an article — hides it from the public reader but keeps the row
 * (and its versions) for posterity. Allowed from any non-ARCHIVED status.
 */
export const POST = withAdmin(async (_req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    try {
        const article = await prisma.article.findUnique({
            where: { slug },
            select: { id: true, status: true },
        })
        if (!article) {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        if (article.status === "ARCHIVED") {
            return NextResponse.json({ ok: true, status: "ARCHIVED" })
        }
        await prisma.article.update({
            where: { id: article.id },
            data: {
                status: "ARCHIVED",
                reviewedAt: new Date(),
                reviewedBy: principal.userId,
            },
        })
        return NextResponse.json({ ok: true, status: "ARCHIVED" })
    } catch (e) {
        console.error("Archive article failed:", e)
        return NextResponse.json(
            { error: "Failed to archive article." },
            { status: 500 }
        )
    }
})
