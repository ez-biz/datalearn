import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { ArticleRejectInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

/**
 * Reject a SUBMITTED article — sends it back to DRAFT with reviewNotes.
 * The author sees the notes when they reopen the editor.
 */
export const POST = withAdmin(async (req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = ArticleRejectInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    try {
        const article = await prisma.article.findUnique({
            where: { slug },
            select: { id: true, status: true },
        })
        if (!article) {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        if (article.status !== "SUBMITTED") {
            return NextResponse.json(
                {
                    error: `Cannot reject from status ${article.status}. Article must be SUBMITTED.`,
                },
                { status: 409 }
            )
        }
        await prisma.article.update({
            where: { id: article.id },
            data: {
                status: "DRAFT",
                reviewNotes: parsed.data.reviewNotes,
                reviewedAt: new Date(),
                reviewedBy: principal.userId,
            },
        })
        return NextResponse.json({ ok: true, status: "DRAFT" })
    } catch (e) {
        console.error("Reject article failed:", e)
        return NextResponse.json(
            { error: "Failed to reject article." },
            { status: 500 }
        )
    }
})
