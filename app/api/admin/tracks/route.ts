import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { TrackCreateInput, slugify } from "@/lib/admin-validation"

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
}

export const GET = withAdmin(async () => {
    const tracks = await prisma.track.findMany({
        orderBy: [{ createdAt: "desc" }, { name: "asc" }],
        include: { _count: { select: { items: true } } },
    })
    return NextResponse.json({ data: tracks })
})

export const POST = withAdmin(async (req) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body." },
            { status: 400 },
        )
    }

    const parsed = TrackCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: z.treeifyError(parsed.error),
            },
            { status: 400 },
        )
    }

    const slug = parsed.data.slug ?? slugify(parsed.data.name)
    try {
        const track = await prisma.track.create({
            data: { ...parsed.data, slug },
        })
        return NextResponse.json({ data: track }, { status: 201 })
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return NextResponse.json(
                { error: "A track with that slug already exists." },
                { status: 409 },
            )
        }
        console.error("Create track failed:", error)
        return NextResponse.json(
            { error: "Failed to create track." },
            { status: 500 },
        )
    }
})
