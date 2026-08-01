import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { deleteModule, updateModule } from "@/lib/admin-curriculum"
import { ModuleUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string; moduleSlug: string }> }

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    const mod = await prisma.module.findFirst({
        where: { slug: moduleSlug, track: { slug } },
        select: {
            id: true,
            slug: true,
            name: true,
            description: true,
            position: true,
            lessons: {
                orderBy: { position: "asc" },
                select: {
                    position: true,
                    article: {
                        select: {
                            id: true,
                            slug: true,
                            title: true,
                            status: true,
                            readingMinutes: true,
                        },
                    },
                },
            },
        },
    })
    if (!mod) {
        return NextResponse.json({ error: "Module not found." }, { status: 404 })
    }
    return NextResponse.json({ data: mod })
})

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    // ModuleUpdateInput is strict, so a `position` key 400s here rather than
    // being silently ignored. Positions move only through /reorder.
    const parsed = ModuleUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await updateModule(slug, moduleSlug, parsed.data)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
})

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    const result = await deleteModule(slug, moduleSlug)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, deleted: true })
})
