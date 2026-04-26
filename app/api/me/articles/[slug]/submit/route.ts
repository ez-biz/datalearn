import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withContributor } from "@/lib/api-auth"

type Ctx = { params: Promise<{ slug: string }> }

/**
 * Contributor submits their own article for admin review.
 * Allowed only on own DRAFT articles.
 */
export const POST = withContributor(async (_req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const article = await prisma.article.findUnique({
        where: { slug },
        select: { id: true, status: true, authorId: true },
    })
    if (!article || article.authorId !== principal.userId) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    if (article.status === "SUBMITTED") {
        return NextResponse.json({ ok: true, status: "SUBMITTED" })
    }
    if (article.status !== "DRAFT") {
        return NextResponse.json(
            {
                error: `Cannot submit from status ${article.status}. Article must be DRAFT.`,
            },
            { status: 409 }
        )
    }
    try {
        const updated = await prisma.article.update({
            where: { id: article.id },
            data: { status: "SUBMITTED", reviewNotes: null },
            select: { status: true },
        })
        return NextResponse.json({ ok: true, status: updated.status })
    } catch (e) {
        console.error("Contributor submit failed:", e)
        return NextResponse.json(
            { error: "Failed to submit article." },
            { status: 500 }
        )
    }
})
