import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { removeTrackItem } from "@/lib/admin-tracks"

type Ctx = { params: Promise<{ slug: string; itemId: string }> }

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug, itemId } = await ctx.params
    const result = await removeTrackItem(slug, itemId)
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status },
        )
    }
    return NextResponse.json({ ok: true })
})
