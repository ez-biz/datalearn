import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { deriveContestStatus } from "@/lib/contest-status"

type Ctx = { params: Promise<{ slug: string }> }

export async function GET(_req: Request, ctx: Ctx) {
    const { slug } = await ctx.params
    const contest = await prisma.contest.findUnique({
        where: { slug },
        select: {
            startsAt: true,
            endsAt: true,
            status: true,
        },
    })
    if (!contest) {
        return NextResponse.json({ error: "Not found." }, { status: 404 })
    }

    const serverNow = new Date()
    return NextResponse.json({
        data: {
            serverNow: serverNow.toISOString(),
            startsAt: contest.startsAt.toISOString(),
            endsAt: contest.endsAt.toISOString(),
            status: deriveContestStatus(
                contest.startsAt,
                contest.endsAt,
                contest.status,
                serverNow
            ),
        },
    })
}
