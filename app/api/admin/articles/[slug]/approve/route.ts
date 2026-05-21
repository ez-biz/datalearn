import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { snapshotArticleVersion } from "@/lib/article-versions"
import { validateArticleDirectivesForPublish } from "@/actions/article-publish-validation"

type Ctx = { params: Promise<{ slug: string }> }

/**
 * Approve an article — admin sign-off, status goes to PUBLISHED, snapshot fires.
 * Allowed from SUBMITTED, DRAFT, or ARCHIVED. Idempotent for already-PUBLISHED.
 */
export const POST = withAdmin(async (_req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    try {
        const article = await prisma.article.findUnique({
            where: { slug },
            select: {
                id: true,
                status: true,
                content: true,
                authorId: true,
                hasVisualBlocks: true,
            },
        })
        if (!article) {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        const validation = await validateArticleDirectivesForPublish(
            article.content,
            article.authorId
        )
        if (!validation.ok) {
            return NextResponse.json(
                { error: "directive-validation", errors: validation.errors },
                { status: 400 }
            )
        }
        if (article.status === "PUBLISHED") {
            if (article.hasVisualBlocks !== validation.hasVisualBlocks) {
                await prisma.article.update({
                    where: { id: article.id },
                    data: { hasVisualBlocks: validation.hasVisualBlocks },
                })
            }
            return NextResponse.json({ ok: true, status: "PUBLISHED" })
        }
        const result = await prisma.$transaction(async (tx) => {
            await tx.article.update({
                where: { id: article.id },
                data: {
                    status: "PUBLISHED",
                    hasVisualBlocks: validation.hasVisualBlocks,
                    reviewNotes: null,
                    reviewedAt: new Date(),
                    reviewedBy: principal.userId,
                },
            })
            await snapshotArticleVersion(tx, article.id, principal.userId)
            return { ok: true, status: "PUBLISHED" as const }
        })
        return NextResponse.json(result)
    } catch (e) {
        console.error("Approve article failed:", e)
        return NextResponse.json(
            { error: "Failed to approve article." },
            { status: 500 }
        )
    }
})
