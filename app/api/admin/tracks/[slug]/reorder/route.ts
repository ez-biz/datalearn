import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { reorderTrackItems } from "@/lib/admin-tracks"
import { TrackReorderInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 },
        )
    }

    const parsed = TrackReorderInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: z.treeifyError(parsed.error),
            },
            { status: 400 },
        )
    }

    const result = await reorderTrackItems(slug, parsed.data.itemIds)
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status },
        )
    }
    return NextResponse.json({ ok: true })
})
