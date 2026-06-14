import { NextResponse } from "next/server"
import { z } from "zod"
import { withAdmin } from "@/lib/api-auth"
import { ContestProblemAttachInput } from "@/lib/admin-validation"
import { lockProblemsForContest } from "@/lib/contest-locks"
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

function hasHiddenEntry(value: unknown, dialect: string): boolean {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        return false
    }
    const entry = (value as Record<string, unknown>)[dialect]
    if (entry === null || entry === undefined) return false
    if (typeof entry === "string") return entry.trim().length > 0
    return true
}

export const POST = withAdmin(async (req, _principal, ctx: Ctx) => {
    const { id: contestId } = await ctx.params
    let body: unknown
    try {
        body = await req.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 })
    }

    const parsed = ContestProblemAttachInput.safeParse(body)
    if (!parsed.success) {
        return NextResponse.json(
            { error: "Validation failed", details: z.treeifyError(parsed.error) },
            { status: 400 }
        )
    }
    const input = parsed.data

    const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: {
            kind: true,
            status: true,
            rated: true,
            startsAt: true,
            endsAt: true,
        },
    })
    if (!contest) {
        return NextResponse.json(
            { error: "Contest not found." },
            { status: 404 }
        )
    }
    const contestStatus = deriveContestStatus(
        contest.startsAt,
        contest.endsAt,
        contest.status
    )
    if (contestStatus !== "SCHEDULED") {
        return NextResponse.json(
            { error: `Cannot modify problems on ${contestStatus} contest.` },
            { status: 409 }
        )
    }

    const problem = await prisma.sQLProblem.findUnique({
        where: { id: input.problemId },
        select: {
            id: true,
            status: true,
            dialects: true,
            hiddenSchemas: true,
            hiddenExpectedOutputs: true,
        },
    })
    if (!problem) {
        return NextResponse.json(
            { error: "Problem not found." },
            { status: 404 }
        )
    }
    if (problem.status !== "PUBLISHED") {
        return NextResponse.json(
            { error: "Problem is not published." },
            { status: 409 }
        )
    }
    if (contest.rated) {
        const missing = problem.dialects.filter(
            (dialect) =>
                !hasHiddenEntry(problem.hiddenSchemas, dialect) ||
                !hasHiddenEntry(problem.hiddenExpectedOutputs, dialect)
        )
        if (missing.length > 0) {
            return NextResponse.json(
                {
                    error: `Problem is missing hidden test data for dialects: ${missing.join(", ")}.`,
                },
                { status: 422 }
            )
        }
    }

    try {
        await prisma.$transaction(async (tx) => {
            await tx.contestProblem.create({
                data: {
                    contestId,
                    problemId: input.problemId,
                    position: input.position,
                    points: input.points,
                },
            })
            if (contest.kind !== "USER_CUSTOM") {
                await lockProblemsForContest(tx, contestId, [input.problemId])
            }
        })
        return NextResponse.json(
            { data: { contestId, problemId: input.problemId } },
            { status: 201 }
        )
    } catch (error) {
        if (isPrismaCode(error, "P2002")) {
            return NextResponse.json(
                { error: "Problem already attached or position is taken." },
                { status: 409 }
            )
        }
        if (error instanceof Error && error.message.includes("already locked")) {
            return NextResponse.json({ error: error.message }, { status: 409 })
        }
        console.error("Attach contest problem failed:", error)
        return NextResponse.json(
            { error: "Failed to attach problem." },
            { status: 500 }
        )
    }
})
