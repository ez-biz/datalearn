import crypto from "node:crypto"
import type { ContestVerdict, Prisma } from "@prisma/client"
import { prisma } from "./prisma"
import { submitToJudge, type JudgeVerdict } from "./contest-judge"
import { deriveContestStatus } from "./contest-status"

type Dialect = "DUCKDB" | "POSTGRES"

type JsonRecord = Record<string, unknown>

export type SubmitContestEntryArgs = {
    contestId: string
    userId: string
    problemId: string
    sql: string
    dialect: Dialect
    idempotencyKey: string
    ipHash: string
    userAgent: string
}

export type SubmitContestEntryOutcome = {
    verdict: JudgeVerdict
    attemptNumber: number
    acceptedAt: Date | null
    message?: string
}

export class ContestNotLiveError extends Error {
    constructor() {
        super("CONTEST_NOT_LIVE")
        this.name = "ContestNotLiveError"
    }
}

export class NotRegisteredError extends Error {
    constructor() {
        super("NOT_REGISTERED")
        this.name = "NotRegisteredError"
    }
}

export async function submitContestEntry(
    args: SubmitContestEntryArgs,
): Promise<SubmitContestEntryOutcome> {
    const cached = await readCachedSubmission(args)
    if (cached) return cached

    const contest = await prisma.contest.findUnique({
        where: { id: args.contestId },
        select: {
            id: true,
            kind: true,
            status: true,
            startsAt: true,
            endsAt: true,
            problems: {
                where: { problemId: args.problemId },
                select: { points: true },
                take: 1,
            },
        },
    })
    if (!contest) throw new Error("CONTEST_NOT_FOUND")
    if (
        deriveContestStatus(
            contest.startsAt,
            contest.endsAt,
            contest.status,
        ) !== "LIVE"
    ) {
        throw new ContestNotLiveError()
    }

    const contestProblem = contest.problems[0]
    if (!contestProblem) throw new Error("PROBLEM_NOT_IN_CONTEST")

    if (contest.kind !== "USER_CUSTOM") {
        const registration = await prisma.contestRegistration.findUnique({
            where: {
                contestId_userId: {
                    contestId: args.contestId,
                    userId: args.userId,
                },
            },
            select: { contestId: true },
        })
        if (!registration) throw new NotRegisteredError()
    }

    const problem = await prisma.sQLProblem.findUniqueOrThrow({
        where: { id: args.problemId },
        select: {
            dialects: true,
            hiddenSchemas: true,
            hiddenExpectedOutputs: true,
            ordered: true,
        },
    })
    if (!problem.dialects.includes(args.dialect)) {
        throw new Error("DIALECT_NOT_ALLOWED")
    }

    const hiddenSchemas = asRecord(problem.hiddenSchemas)
    const hiddenExpectedOutputs = asRecord(problem.hiddenExpectedOutputs)
    const hiddenSchemaSql = hiddenSchemas?.[args.dialect]
    const hiddenExpected = hiddenExpectedOutputs?.[args.dialect]
    if (typeof hiddenSchemaSql !== "string" || !isRows(hiddenExpected)) {
        throw new Error(`HIDDEN_DATA_MISSING:${args.dialect}`)
    }

    const judge = await submitToJudge({
        dialect: args.dialect,
        userSql: args.sql,
        hiddenSchemaSql,
        hiddenExpected,
        ordered: problem.ordered,
    })

    const sqlHash = sha256(args.sql)
    const simhash = computeSimHash64Hex(args.sql)

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const result = await prisma.$transaction(async (tx) => {
                const cachedInTx = await readCachedSubmission(args, tx)
                if (cachedInTx) return cachedInTx

                const attemptNumber = await nextAttemptNumber(args, tx)
                const acceptedAt =
                    judge.verdict === "ACCEPTED" ? new Date() : null
                const submission = await tx.submission.create({
                    data: {
                        userId: args.userId,
                        problemId: args.problemId,
                        status:
                            judge.verdict === "ACCEPTED"
                                ? "ACCEPTED"
                                : "WRONG_ANSWER",
                        code: args.sql,
                        reason: judge.message ?? null,
                    },
                    select: { id: true },
                })

                await tx.contestSubmission.create({
                    data: {
                        contestId: args.contestId,
                        userId: args.userId,
                        problemId: args.problemId,
                        submissionId: submission.id,
                        idempotencyKey: args.idempotencyKey,
                        sqlHash,
                        simhash,
                        attemptNumber,
                        verdict: judge.verdict as ContestVerdict,
                        acceptedAt,
                        ipHash: args.ipHash,
                        userAgent: args.userAgent,
                    },
                })

                if (judge.verdict === "ACCEPTED") {
                    await recordFirstSolveAndLeaderboard({
                        tx,
                        contestId: args.contestId,
                        userId: args.userId,
                        problemId: args.problemId,
                        submissionId: submission.id,
                        acceptedAt: acceptedAt!,
                        attemptNumber,
                        contestStartsAt: contest.startsAt,
                    })
                }

                return {
                    verdict: judge.verdict,
                    attemptNumber,
                    acceptedAt,
                    message: judge.message,
                }
            })
            return result
        } catch (error: unknown) {
            if (attempt === 0 && isPrismaUniqueViolation(error)) {
                continue
            }
            throw error
        }
    }

    throw new Error("CONTEST_SUBMIT_RETRY_EXHAUSTED")
}

async function readCachedSubmission(
    args: Pick<
        SubmitContestEntryArgs,
        "contestId" | "userId" | "idempotencyKey"
    >,
    db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<SubmitContestEntryOutcome | null> {
    const cached = await db.contestSubmission.findUnique({
        where: {
            contestId_userId_idempotencyKey: {
                contestId: args.contestId,
                userId: args.userId,
                idempotencyKey: args.idempotencyKey,
            },
        },
        select: {
            verdict: true,
            attemptNumber: true,
            acceptedAt: true,
            submission: { select: { reason: true } },
        },
    })
    if (!cached) return null
    return {
        verdict: cached.verdict,
        attemptNumber: cached.attemptNumber,
        acceptedAt: cached.acceptedAt,
        message: cached.submission.reason ?? undefined,
    }
}

async function nextAttemptNumber(
    args: Pick<SubmitContestEntryArgs, "contestId" | "userId" | "problemId">,
    tx: Prisma.TransactionClient,
): Promise<number> {
    const latest = await tx.contestSubmission.findFirst({
        where: {
            contestId: args.contestId,
            userId: args.userId,
            problemId: args.problemId,
        },
        orderBy: { attemptNumber: "desc" },
        select: { attemptNumber: true },
    })
    return (latest?.attemptNumber ?? 0) + 1
}

export async function recordFirstSolveAndLeaderboard(args: {
    tx: Prisma.TransactionClient
    contestId: string
    userId: string
    problemId: string
    submissionId: string
    acceptedAt: Date
    attemptNumber: number
    contestStartsAt: Date
}): Promise<void> {
    const wrongAttemptsBeforeAccept = await args.tx.contestSubmission.count({
        where: {
            contestId: args.contestId,
            userId: args.userId,
            problemId: args.problemId,
            verdict: { not: "ACCEPTED" },
            attemptNumber: { lt: args.attemptNumber },
        },
    })

    const inserted = await args.tx.contestProblemSolve.createMany({
        data: {
            contestId: args.contestId,
            userId: args.userId,
            problemId: args.problemId,
            submissionId: args.submissionId,
            acceptedAt: args.acceptedAt,
            wrongAttemptsBeforeAccept,
        },
        skipDuplicates: true,
    })
    if (inserted.count === 0) return

    const solves = await args.tx.contestProblemSolve.findMany({
        where: { contestId: args.contestId, userId: args.userId },
        select: {
            problemId: true,
            acceptedAt: true,
            wrongAttemptsBeforeAccept: true,
        },
    })
    const contestProblems = await args.tx.contestProblem.findMany({
        where: {
            contestId: args.contestId,
            problemId: { in: solves.map((solve) => solve.problemId) },
        },
        select: { problemId: true, points: true },
    })
    const pointsByProblem = new Map(
        contestProblems.map((problem) => [problem.problemId, problem.points]),
    )

    let points = 0
    let penaltySeconds = 0
    for (const solve of solves) {
        points += pointsByProblem.get(solve.problemId) ?? 0
        penaltySeconds += Math.max(
            0,
            Math.floor(
                (solve.acceptedAt.getTime() - args.contestStartsAt.getTime()) /
                    1000,
            ),
        )
        penaltySeconds += solve.wrongAttemptsBeforeAccept * 300
    }

    await args.tx.contestLeaderboardEntry.upsert({
        where: {
            contestId_userId: {
                contestId: args.contestId,
                userId: args.userId,
            },
        },
        create: {
            contestId: args.contestId,
            userId: args.userId,
            points,
            penaltySeconds,
            solvedCount: solves.length,
            rank: 0,
        },
        update: {
            points,
            penaltySeconds,
            solvedCount: solves.length,
        },
    })
}

function asRecord(value: unknown): JsonRecord | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null
    return value as JsonRecord
}

function isRows(value: unknown): value is Record<string, unknown>[] {
    return (
        Array.isArray(value) &&
        value.every(
            (row) =>
                row !== null && typeof row === "object" && !Array.isArray(row),
        )
    )
}

function sha256(value: string): string {
    return crypto.createHash("sha256").update(value).digest("hex")
}

function computeSimHash64Hex(value: string): string {
    return crypto
        .createHash("sha256")
        .update(value)
        .digest()
        .subarray(0, 8)
        .toString("hex")
}

function isPrismaUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    )
}
