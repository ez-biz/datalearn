import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { TopicUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const topic = await prisma.topic.findUnique({
        where: { slug },
        include: { _count: { select: { articles: true } } },
    })
    if (!topic) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    return NextResponse.json({ data: topic })
})

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = TopicUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    try {
        const topic = await prisma.topic.update({
            where: { slug },
            data: parsed.data,
        })
        return NextResponse.json({ data: topic })
    } catch (e: any) {
        if (e?.code === "P2025") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        if (e?.code === "P2002") {
            return NextResponse.json(
                { error: "A topic with that name or slug already exists." },
                { status: 409 }
            )
        }
        console.error("Update topic failed:", e)
        return NextResponse.json(
            { error: "Failed to update topic." },
            { status: 500 }
        )
    }
})

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    try {
        // Block delete if any articles reference this topic.
        const count = await prisma.article.count({
            where: { topic: { slug } },
        })
        if (count > 0) {
            return NextResponse.json(
                {
                    error: `Topic still has ${count} article${count === 1 ? "" : "s"}. Move or delete them first.`,
                },
                { status: 409 }
            )
        }
        await prisma.topic.delete({ where: { slug } })
        return NextResponse.json({ ok: true })
    } catch (e: any) {
        if (e?.code === "P2025") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        console.error("Delete topic failed:", e)
        return NextResponse.json(
            { error: "Failed to delete topic." },
            { status: 500 }
        )
    }
})
