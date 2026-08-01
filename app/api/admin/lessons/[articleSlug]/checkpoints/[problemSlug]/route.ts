import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { removeCheckpoint } from "@/lib/admin-curriculum"

type Ctx = { params: Promise<{ articleSlug: string; problemSlug: string }> }

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { articleSlug, problemSlug } = await ctx.params
    const result = await removeCheckpoint(articleSlug, problemSlug)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, removed: true })
})
