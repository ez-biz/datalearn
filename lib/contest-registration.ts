import { deriveContestStatus } from "@/lib/contest-status"
import { prisma } from "@/lib/prisma"

export async function registerContestParticipantUnchecked(args: {
    contestId: string
    userId: string
}): Promise<{ status: "registered" | "already_registered" }> {
    return prisma.$transaction(async (tx) => {
        const contest = await tx.contest.findUnique({
            where: { id: args.contestId },
            select: {
                id: true,
                slug: true,
                kind: true,
                visibility: true,
                rated: true,
                startsAt: true,
                endsAt: true,
                status: true,
                maxParticipants: true,
                _count: { select: { registrations: true } },
            },
        })
        if (
            !contest ||
            contest.kind === "USER_CUSTOM" ||
            contest.visibility !== "PUBLIC" ||
            contest.status === "CANCELLED"
        ) {
            throw new Error("CONTEST_NOT_FOUND")
        }

        const publicStatus = deriveContestStatus(
            contest.startsAt,
            contest.endsAt,
            contest.status
        )
        if (publicStatus === "CLOSED") {
            throw new Error("CONTEST_CLOSED")
        }

        const existing = await tx.contestRegistration.findUnique({
            where: {
                contestId_userId: {
                    contestId: args.contestId,
                    userId: args.userId,
                },
            },
            select: { contestId: true },
        })
        if (existing) return { status: "already_registered" }

        if (
            contest.maxParticipants !== null &&
            contest._count.registrations >= contest.maxParticipants
        ) {
            throw new Error("CONTEST_FULL")
        }

        await tx.contestRegistration.create({
            data: {
                contestId: args.contestId,
                userId: args.userId,
                ratedAtStart: contest.rated,
            },
        })
        return { status: "registered" }
    })
}
