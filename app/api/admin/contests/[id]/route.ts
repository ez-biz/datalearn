import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import {
    ContestUpdateInput,
    MAX_CONTEST_MINUTES,
    MIN_CONTEST_MINUTES,
    isContestDurationInRange,
} from "@/lib/admin-validation"
import { deriveContestStatus } from "@/lib/contest-status"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string }> }

function isPrismaCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    )
}

const contestInclude = {
    problems: {
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
    _count: { select: { registrations: true } },
}

export const GET = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { id } = await ctx.params
    const contest = await prisma.contest.findUnique({
        where: { id },
        include: contestInclude,
    })
    if (!contest) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    return NextResponse.json({ data: contest })
})

export const PATCH = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { id } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ContestUpdateInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }

    const current = await prisma.contest.findUnique({
        where: { id },
        select: { status: true, startsAt: true, endsAt: true },
    })
    if (!current) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }
    const currentStatus = deriveContestStatus(
        current.startsAt,
        current.endsAt,
        current.status
    )
    if (currentStatus !== "SCHEDULED") {
        return NextResponse.json(
            { error: `Cannot edit contest in status ${currentStatus}.` },
            { status: 409 }
        )
    }

    const input = parsed.data
    const startsAt = input.startsAt ?? current.startsAt
    const endsAt = input.endsAt ?? current.endsAt
    if (endsAt <= startsAt) {
        return NextResponse.json(
            { error: "endsAt must be after startsAt." },
            { status: 400 }
        )
    }
    const durationMinutes = Math.round(
        (endsAt.getTime() - startsAt.getTime()) / 60_000
    )
    if (!isContestDurationInRange(durationMinutes)) {
        return NextResponse.json(
            {
                error: `Contest must be between ${MIN_CONTEST_MINUTES} minutes and ${MAX_CONTEST_MINUTES} minutes.`,
            },
            { status: 400 }
        )
    }

    try {
        const updated = await prisma.$transaction(async (tx) => {
            const contest = await tx.contest.update({
                where: { id },
                data: { ...input, durationMinutes },
                include: contestInclude,
            })
            if (input.endsAt) {
                await tx.contestProblemLock.updateMany({
                    where: { contestId: id },
                    data: { unlocksAt: input.endsAt },
                })
            }
            return contest
        })
        return NextResponse.json({ data: updated })
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return NextResponse.json(
                { error: "A contest with that slug already exists." },
                { status: 409 }
            )
        }
        console.error("Update contest failed:", error)
        return NextResponse.json(
            { error: "Failed to update contest." },
            { status: 500 }
        )
    }
})
