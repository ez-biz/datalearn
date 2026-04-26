import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withContributor } from "@/lib/api-auth"
import {
    ArticleCreateInput,
    computeReadingMinutes,
} from "@/lib/admin-validation"

/**
 * GET /api/me/articles — list the current user's articles in any status.
 */
export const GET = withContributor(async (_req, principal) => {
    const articles = await prisma.article.findMany({
        where: { authorId: principal.userId },
        orderBy: { updatedAt: "desc" },
        include: {
            topic: { select: { slug: true, name: true } },
            tags: { select: { id: true, slug: true, name: true } },
        },
    })
    return NextResponse.json({ data: articles })
})

/**
 * POST /api/me/articles — create a new article authored by the current user.
 *
 * Status is forced to DRAFT regardless of the input — contributors can only
 * promote via the explicit submit endpoint, which itself only goes to
 * SUBMITTED. Approve/Archive remain admin-only.
 *
 * relatedProblems is allowed at create time (so the contributor sets context),
 * tags too. Topic must exist.
 */
export const POST = withContributor(async (req, principal) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = ArticleCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data

    try {
        const created = await prisma.$transaction(async (tx) => {
            const topic = await tx.topic.findUnique({
                where: { slug: input.topicSlug },
                select: { id: true },
            })
            if (!topic) throw new Error("TOPIC_NOT_FOUND")

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

            return tx.article.create({
                data: {
                    title: input.title,
                    slug: input.slug,
                    topicId: topic.id,
                    content: input.content,
                    summary: input.summary ?? null,
                    status: "DRAFT", // forced — contributors don't choose
                    readingMinutes: computeReadingMinutes(input.content),
                    authorId: principal.userId,
                    tags: { connect: tagIds.map((id) => ({ id })) },
                    relatedProblems: {
                        connect: problemIds.map((id) => ({ id })),
                    },
                },
                include: {
                    topic: { select: { slug: true, name: true } },
                    tags: { select: { id: true, slug: true, name: true } },
                },
            })
        })
        return NextResponse.json({ data: created }, { status: 201 })
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
            return NextResponse.json(
                { error: `Unknown problem slugs: ${e.message.split(":")[1]}` },
                { status: 400 }
            )
        }
        if (e?.code === "P2002") {
            return NextResponse.json(
                { error: "An article with that slug already exists." },
                { status: 409 }
            )
        }
        console.error("Contributor create article failed:", e)
        return NextResponse.json(
            { error: "Failed to create article." },
            { status: 500 }
        )
    }
})
