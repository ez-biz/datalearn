import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { addCheckpoint } from "@/lib/admin-curriculum"
import { CheckpointAddInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ articleSlug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { articleSlug } = await ctx.params
    const article = await prisma.article.findUnique({
        where: { slug: articleSlug },
        select: { id: true },
    })
    if (!article) {
        return NextResponse.json({ error: "Lesson not found." }, { status: 404 })
    }
    const checkpoints = await prisma.lessonCheckpoint.findMany({
        where: { articleId: article.id },
        orderBy: { position: "asc" },
        select: {
            position: true,
            problem: {
                select: {
                    id: true,
                    number: true,
                    slug: true,
                    title: true,
                    difficulty: true,
                    status: true,
                },
            },
        },
    })
    return NextResponse.json({ data: checkpoints })
})

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { articleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = CheckpointAddInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await addCheckpoint(articleSlug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data }, { status: 201 })
})
