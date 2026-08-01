import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { reorderCheckpoints } from "@/lib/admin-curriculum"
import { CheckpointReorderInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ articleSlug: string }> }

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { articleSlug } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = CheckpointReorderInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 },
        )
    }

    const result = await reorderCheckpoints(articleSlug, parsed.data.problemSlugs)
    if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true })
})
