import type { Prisma, PrismaClient } from "@prisma/client"

type Db = PrismaClient | Prisma.TransactionClient

export function excludeLockedProblems(
    where: Prisma.SQLProblemWhereInput = {},
    now: Date = new Date()
): Prisma.SQLProblemWhereInput {
    const unlockedWhere: Prisma.SQLProblemWhereInput = {
        OR: [
            { contestLock: { is: null } },
            { contestLock: { is: { unlocksAt: { lte: now } } } },
        ],
    }
    if (Object.keys(where).length === 0) {
        return unlockedWhere
    }
    return { AND: [where, unlockedWhere] }
}

export async function isProblemLocked(
    db: Db,
    problemId: string,
    now: Date = new Date()
): Promise<boolean> {
    const row = await db.contestProblemLock.findUnique({
        where: { problemId },
        select: { unlocksAt: true },
    })
    return row !== null && row.unlocksAt > now
}

export async function lockProblemsForContest(
    db: Db,
    contestId: string,
    problemIds: string[]
): Promise<void> {
    if (problemIds.length === 0) return

    const contest = await db.contest.findUniqueOrThrow({
        where: { id: contestId },
        select: { endsAt: true },
    })

    for (const problemId of problemIds) {
        const existing = await db.contestProblemLock.findUnique({
            where: { problemId },
            select: { contestId: true, unlocksAt: true },
        })
        if (existing && existing.unlocksAt <= new Date()) {
            await db.contestProblemLock.delete({ where: { problemId } })
        } else if (existing && existing.contestId !== contestId) {
            throw new Error(
                `Problem ${problemId} is already locked by contest ${existing.contestId}`
            )
        } else if (existing) {
            if (existing.unlocksAt.getTime() !== contest.endsAt.getTime()) {
                await db.contestProblemLock.update({
                    where: { problemId },
                    data: { unlocksAt: contest.endsAt },
                })
            }
            continue
        }
        await db.contestProblemLock.create({
            data: { problemId, contestId, unlocksAt: contest.endsAt },
        })
    }
}

export async function unlockProblemsForContest(
    db: Db,
    contestId: string
): Promise<void> {
    await db.contestProblemLock.deleteMany({ where: { contestId } })
}

export async function unlockProblem(
    db: Db,
    contestId: string,
    problemId: string
): Promise<void> {
    await db.contestProblemLock.deleteMany({
        where: { contestId, problemId },
    })
}

export async function sweepExpiredLocks(
    db: Db,
    now: Date = new Date()
): Promise<number> {
    const result = await db.contestProblemLock.deleteMany({
        where: { unlocksAt: { lte: now } },
    })
    return result.count
}
