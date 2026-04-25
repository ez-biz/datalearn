import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { TopicCreateInput } from "@/lib/admin-validation"

export const GET = withAdmin(async () => {
    const topics = await prisma.topic.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { articles: true } } },
    })
    return NextResponse.json({ data: topics })
})

export const POST = withAdmin(async (req) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = TopicCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    try {
        const topic = await prisma.topic.create({
            data: parsed.data,
        })
        return NextResponse.json({ data: topic }, { status: 201 })
    } catch (e: any) {
        if (e?.code === "P2002") {
            return NextResponse.json(
                { error: "A topic with that name or slug already exists." },
                { status: 409 }
            )
        }
        console.error("Create topic failed:", e)
        return NextResponse.json(
            { error: "Failed to create topic." },
            { status: 500 }
        )
    }
})
