import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"

type Ctx = { params: Promise<{ slug: string }> }

/**
 * Move an article from DRAFT to SUBMITTED — author handed it off for review.
 * Idempotent: re-submitting an already-SUBMITTED article is a no-op success.
 */
export const POST = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    try {
        const article = await prisma.article.findUnique({
            where: { slug },
            select: { id: true, status: true },
        })
        if (!article) {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        if (article.status === "SUBMITTED") {
            return NextResponse.json({ ok: true, status: "SUBMITTED" })
        }
        if (article.status !== "DRAFT") {
            return NextResponse.json(
                {
                    error: `Cannot submit from status ${article.status}. Move to DRAFT first.`,
                },
                { status: 409 }
            )
        }
        const updated = await prisma.article.update({
            where: { id: article.id },
            data: { status: "SUBMITTED", reviewNotes: null },
            select: { status: true },
        })
        return NextResponse.json({ ok: true, status: updated.status })
    } catch (e) {
        console.error("Submit article failed:", e)
        return NextResponse.json(
            { error: "Failed to submit article." },
            { status: 500 }
        )
    }
})
