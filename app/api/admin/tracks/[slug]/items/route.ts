import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { addTrackItemToTrack } from "@/lib/admin-tracks"
import { TrackItemAddInput } from "@/lib/admin-validation"

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

    const parsed = TrackItemAddInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: z.treeifyError(parsed.error),
            },
            { status: 400 },
        )
    }

    const result = await addTrackItemToTrack(slug, parsed.data)
    if (!result.ok) {
        return NextResponse.json(
            { error: result.error },
            { status: result.status },
        )
    }
    return NextResponse.json({ data: result.data }, { status: 201 })
})
