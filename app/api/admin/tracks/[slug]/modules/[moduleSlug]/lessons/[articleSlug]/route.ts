import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { removeLessonFromModule } from "@/lib/admin-curriculum"

type Ctx = {
    params: Promise<{ slug: string; moduleSlug: string; articleSlug: string }>
}

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, moduleSlug, articleSlug } = await ctx.params
    const result = await removeLessonFromModule(slug, moduleSlug, articleSlug)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, removed: true })
})
