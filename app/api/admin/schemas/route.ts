import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { SqlSchemaCreateInput } from "@/lib/admin-validation"

export const GET = withAdmin(async () => {
    const schemas = await prisma.sqlSchema.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { problems: true } } },
    })
    return NextResponse.json({ data: schemas })
})

export const POST = withAdmin(async (req) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }
    const parsed = SqlSchemaCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    try {
        const created = await prisma.sqlSchema.create({
            data: parsed.data,
        })
        return NextResponse.json({ data: created }, { status: 201 })
    } catch (e: any) {
        if (e?.code === "P2002") {
            return NextResponse.json(
                { error: "A schema with that name already exists." },
                { status: 409 }
            )
        }
        console.error("Create schema failed:", e)
        return NextResponse.json(
            { error: "Failed to create schema." },
            { status: 500 }
        )
    }
})
