import { NextResponse } from "next/server"
import { withAdmin } from "@/lib/api-auth"
import { unlockProblem } from "@/lib/contest-locks"
import { deriveContestStatus } from "@/lib/contest-status"
import { prisma } from "@/lib/prisma"

type Ctx = { params: Promise<{ id: string; problemId: string }> }

export const DELETE = withAdmin(async (_req, _principal, ctx: Ctx) => {
    const { id: contestId, problemId } = await ctx.params
    const contest = await prisma.contest.findUnique({
        where: { id: contestId },
        select: { status: true, startsAt: true, endsAt: true },
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

    await prisma.$transaction(async (tx) => {
        await tx.contestProblem.deleteMany({ where: { contestId, problemId } })
        await unlockProblem(tx, contestId, problemId)
    })

    return NextResponse.json({ data: { contestId, problemId } })
})
