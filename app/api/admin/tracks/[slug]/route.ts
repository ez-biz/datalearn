import { NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { withAdmin } from "@/lib/api-auth"
import { TrackUpdateInput } from "@/lib/admin-validation"

type Ctx = { params: Promise<{ slug: string }> }

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
}

const trackInclude = {
    items: {
        orderBy: { position: "asc" as const },
        include: {
            problem: {
                select: {
                    id: true,
                    number: true,
                    slug: true,
                    title: true,
                    difficulty: true,
                    status: true,
                },
            },
        },
    },
    _count: { select: { items: true } },
}

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const track = await prisma.track.findUnique({
        where: { slug },
        include: trackInclude,
    })
    if (!track) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    return NextResponse.json({ data: track })
})

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
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

    const parsed = TrackUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            {
                error: "Validation failed",
                details: z.treeifyError(parsed.error),
            },
            { status: 400 },
        )
    }

    try {
        const track = await prisma.track.update({
            where: { slug },
            data: parsed.data,
            include: trackInclude,
        })
        return NextResponse.json({ data: track })
    } catch (error) {
        if (isPrismaCode(error, "P2025")) {
            return NextResponse.json({ error: "Not found." }, { status: 404 })
        }
        if (isPrismaCode(error, "P2002")) {
            return NextResponse.json(
                { error: "A track with that slug already exists." },
                { status: 409 },
            )
        }
        console.error("Update track failed:", error)
        return NextResponse.json(
            { error: "Failed to update track." },
            { status: 500 },
        )
    }
})

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { slug } = await ctx.params
    const track = await prisma.track.findUnique({
        where: { slug },
        select: {
            id: true,
            status: true,
            _count: { select: { items: true } },
        },
    })
    if (!track) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    if (track.status === "DRAFT" && track._count.items === 0) {
        await prisma.track.delete({ where: { id: track.id } })
        return NextResponse.json({ ok: true, deleted: true })
    }

    await prisma.track.update({
        where: { id: track.id },
        data: { status: "ARCHIVED" },
    })
    return NextResponse.json({ ok: true, archived: true })
})
