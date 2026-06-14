import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { ContestCreateInput } from "@/lib/admin-validation"
import { prisma } from "@/lib/prisma"

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
}

export const GET = withAdmin(async () => {
    const contests = await prisma.contest.findMany({
        orderBy: [{ startsAt: "desc" }, { title: "asc" }],
        select: {
            id: true,
            slug: true,
            title: true,
            description: true,
            kind: true,
            status: true,
            startsAt: true,
            endsAt: true,
            durationMinutes: true,
            rated: true,
            maxParticipants: true,
            _count: { select: { problems: true, registrations: true } },
        },
    })
    return NextResponse.json({ data: contests })
})

export const POST = withAdmin(async (req, principal) => {
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ContestCreateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data
    const durationMinutes = Math.round(
        (input.endsAt.getTime() - input.startsAt.getTime()) / 60_000
    )

    try {
        const created = await prisma.contest.create({
            data: {
                slug: input.slug,
                title: input.title,
                description: input.description,
                kind: input.kind,
                startsAt: input.startsAt,
                endsAt: input.endsAt,
                durationMinutes,
                rated: input.rated,
                maxParticipants: input.maxParticipants ?? null,
                createdById: principal.userId,
            },
            select: { id: true, slug: true },
        })
        return NextResponse.json({ data: created }, { status: 201 })
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return NextResponse.json(
                { error: "A contest with that slug already exists." },
                { status: 409 }
            )
        }
        console.error("Create contest failed:", error)
        return NextResponse.json(
            { error: "Failed to create contest." },
            { status: 500 }
        )
    }
})
