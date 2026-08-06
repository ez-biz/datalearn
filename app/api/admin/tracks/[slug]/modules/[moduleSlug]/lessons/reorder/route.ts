import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { reorderModuleLessons } from "@/lib/admin-curriculum"
import { ModuleLessonReorderInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string; moduleSlug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ModuleLessonReorderInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await reorderModuleLessons(
        slug,
        moduleSlug,
        parsed.data.articleSlugs,
    )
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
})
