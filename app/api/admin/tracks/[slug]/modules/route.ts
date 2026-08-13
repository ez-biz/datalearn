import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { createModule } from "@/lib/admin-curriculum"
import { ModuleCreateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const track = await prisma.track.findUnique({
        where: { slug },
        select: { id: true },
    })
    if (!track) {
        return NextResponse.json({ error: "Track not found." }, { status: 404 })
    }
    const modules = await prisma.module.findMany({
        where: { trackId: track.id },
        orderBy: { position: "asc" },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            position: true,
            _count: { select: { lessons: true } },
        },
    })
    return NextResponse.json({ data: modules })
})

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModuleCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await createModule(slug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data }, { status: 201 })
})
