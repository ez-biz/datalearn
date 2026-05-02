import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { SqlSchemaUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { id } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = SqlSchemaUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    try {
        const updated = await prisma.sqlSchema.update({
            where: { id },
            data: parsed.data,
        })
        return NextResponse.json({ data: updated })
    } catch (e: unknown) {
        const error = e as { code?: string }
        if (error.code === "P2025") {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        if (error.code === "P2002") {
            return NextResponse.json(
                { error: "A schema with that name already exists." },
                { status: 409 }
            )
        }
        console.error("Update schema failed:", e)
        return NextResponse.json(
            { error: "Failed to update schema." },
            { status: 500 }
        )
    }
})
