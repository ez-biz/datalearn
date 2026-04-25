import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import {
    ArticleUpdateInput,
    computeReadingMinutes,
} from "@/lib/admin-validation"
import { snapshotArticleVersion } from "@/lib/article-versions"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const article = await prisma.article.findUnique({
        where: { slug },
        include: {
            topic: { select: { slug: true, name: true } },
            tags: { select: { id: true, slug: true, name: true } },
            relatedProblems: { select: { id: true, slug: true, title: true } },
            author: { select: { id: true, name: true, email: true } },
        },
    })
    if (!article) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    return NextResponse.json({ data: article })
})

export const PATCH = withAdmin(async (req, principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = ArticleUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data

    const existing = await prisma.article.findUnique({
        where: { slug },
        select: { id: true, status: true },
    })
    if (!existing) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    const becomingPublished =
        input.status === "PUBLISHED" && existing.status !== "PUBLISHED"

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const data: any = {
                ...(input.title !== undefined && { title: input.title }),
                ...(input.slug !== undefined && { slug: input.slug }),
                ...(input.content !== undefined && {
                    content: input.content,
                    readingMinutes: computeReadingMinutes(input.content),
                }),
                ...(input.summary !== undefined && { summary: input.summary }),
                ...(input.status !== undefined && { status: input.status }),
            }

            if (input.topicSlug !== undefined) {
                const topic = await tx.topic.findUnique({
                    where: { slug: input.topicSlug },
                    select: { id: true },
                })
                if (!topic) throw new Error("TOPIC_NOT_FOUND")
                data.topicId = topic.id
            }

            if (input.tagSlugs !== undefined) {
                const tagIds: string[] = []
                for (const tagSlug of input.tagSlugs) {
                    const tag = await tx.tag.upsert({
                        where: { slug: tagSlug },
                        update: {},
                        create: { slug: tagSlug, name: tagSlug.replace(/-/g, " ") },
                        select: { id: true },
                    })
                    tagIds.push(tag.id)
                }
                data.tags = { set: tagIds.map((id) => ({ id })) }
            }

            if (input.relatedProblemSlugs !== undefined) {
                const problemIds: string[] = []
                if (input.relatedProblemSlugs.length > 0) {
                    const found = await tx.sQLProblem.findMany({
                        where: { slug: { in: input.relatedProblemSlugs } },
                        select: { id: true, slug: true },
                    })
                    if (found.length !== input.relatedProblemSlugs.length) {
                        const known = new Set(found.map((p) => p.slug))
                        const missing = input.relatedProblemSlugs.filter(
                            (s) => !known.has(s)
                        )
                        throw new Error(`UNKNOWN_PROBLEM_SLUGS:${missing.join(",")}`)
                    }
                    for (const p of found) problemIds.push(p.id)
                }
                data.relatedProblems = {
                    set: problemIds.map((id) => ({ id })),
                }
            }

            const result = await tx.article.update({
                where: { id: existing.id },
                data,
                include: {
                    topic: { select: { slug: true, name: true } },
                    tags: { select: { id: true, slug: true, name: true } },
                    relatedProblems: { select: { id: true, slug: true, title: true } },
                },
            })
            if (becomingPublished) {
                await snapshotArticleVersion(tx, existing.id, principal.userId)
            }
            return result
        })
        return NextResponse.json({ data: updated })
    } catch (e: any) {
        if (e?.message === "TOPIC_NOT_FOUND") {
            return NextResponse.json(
                { error: "topicSlug does not match any Topic." },
                { status: 400 }
            )
        }
        if (
            typeof e?.message === "string" &&
            e.message.startsWith("UNKNOWN_PROBLEM_SLUGS:")
        ) {
            const slugs = e.message.split(":")[1]
            return NextResponse.json(
                { error: `Unknown problem slugs: ${slugs}` },
                { status: 400 }
            )
        }
        if (e?.code === "P2002") {
            return NextResponse.json(
                { error: "An article with that slug already exists." },
                { status: 409 }
            )
        }
        console.error("Update article failed:", e)
        return NextResponse.json(
            { error: "Failed to update article." },
            { status: 500 }
        )
    }
})

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    try {
        await prisma.article.delete({ where: { slug } })
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        if (e?.code === "P2025") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        console.error("Delete article failed:", e)
        return NextResponse.json(
            { error: "Failed to delete article." },
            { status: 500 }
        )
    }
})
