import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { TagCreateInput, slugify } from "@/lib/admin-validation"

export const GET = withAdmin(async () => {
    const tags = await prisma.tag.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { problems: true } } },
    })
    return NextResponse.json({ data: tags })
})

export const POST = withAdmin(async (req) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 },
        )
    }
    const parsed = TagCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: z.treeifyError(parsed.error),
            },
            { status: 400 },
        )
    }
    const slug = parsed.data.slug ?? slugify(parsed.data.name)
    const kindProvided =
        typeof body === "object" && body !== null && "kind" in body
    try {
        const tag = await prisma.tag.upsert({
            where: { slug },
            update: {
                name: parsed.data.name,
                ...(kindProvided ? { kind: parsed.data.kind } : {}),
            },
            create: { name: parsed.data.name, slug, kind: parsed.data.kind },
        })
        return NextResponse.json({ data: tag }, { status: 201 })
    } catch (e) {
        console.error("Create tag failed:", e)
        return NextResponse.json(
            { error: "Failed to create tag." },
            { status: 500 },
        )
    }
})
