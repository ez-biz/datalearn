import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { submitContestEntry } from "../lib/contest-submit"

const PREFIX = "contest-submit-test-"

let pool: pg.Pool
let prisma: PrismaClient
let userId: string
let adminId: string
let schemaId: string
let problemId: string
let contestId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for contest submit tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()

    const admin = await prisma.user.create({
        data: { email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    })
    adminId = admin.id
    const learner = await prisma.user.create({
        data: {
            email: `${PREFIX}learner@example.com`,
            role: "USER",
            emailVerified: new Date(),
        },
    })
    userId = learner.id

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (x INT);" },
    })
    schemaId = schema.id

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 70_000,
            slug: `${PREFIX}problem`,
            title: `${PREFIX}Problem`,
            description: "x",
            schemaDescription: "test schema",
            difficulty: "EASY",
            schemaId,
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
            expectedOutput: "[]",
            expectedOutputs: { DUCKDB: "[]" },
            solutionSql: "SELECT x FROM t ORDER BY x",
            solutions: { DUCKDB: "SELECT x FROM t ORDER BY x" },
            hiddenSchemas: {
                DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1), (2);",
            },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 1 }, { x: 2 }] },
        },
    })
    problemId = problem.id

    const startsAt = new Date(Date.now() - 60_000)
    const endsAt = new Date(Date.now() + 30 * 60_000)
    const contest = await prisma.contest.create({
        data: {
            slug: `${PREFIX}contest`,
            title: `${PREFIX}Contest`,
            description: "x",
            kind: "WEEKLY",
            status: "SCHEDULED",
            startsAt,
            endsAt,
            durationMinutes: 31,
            createdById: adminId,
            rated: false,
        },
    })
    contestId = contest.id

    await prisma.contestProblem.create({
        data: { contestId, problemId, position: 1, points: 3 },
    })
    await prisma.contestRegistration.create({
        data: { contestId, userId, ratedAtStart: false },
    })
})

after(async () => {
    await cleanup()
    await prisma?.$disconnect()
    await pool?.end().catch(() => {})
})

async function cleanup() {
    await prisma?.contestLeaderboardEntry.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contestProblemSolve.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contestSubmission.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.submission.deleteMany({
        where: { problem: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contestProblem.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contestRegistration.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contest.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma?.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma?.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
    await prisma?.user.deleteMany({
        where: { email: { startsWith: PREFIX } },
    })
}

describe("submitContestEntry", () => {
    it("ACCEPTED first solve creates solve row and increments leaderboard", async () => {
        const result = await submitContestEntry({
            contestId,
            userId,
            problemId,
            sql: "SELECT * FROM t ORDER BY x",
            dialect: "DUCKDB",
            idempotencyKey: "k1",
            ipHash: "ip-1",
            userAgent: "test-ua",
        })

        assert.equal(result.verdict, "ACCEPTED")
        const solve = await prisma.contestProblemSolve.findUnique({
            where: {
                contestId_userId_problemId: { contestId, userId, problemId },
            },
        })
        assert.ok(solve)
        const leaderboard = await prisma.contestLeaderboardEntry.findUnique({
            where: { contestId_userId: { contestId, userId } },
        })
        assert.equal(leaderboard?.solvedCount, 1)
        assert.equal(leaderboard?.points, 3)
    })

    it("idempotent retry with same key returns cached verdict without new rows", async () => {
        const before = await prisma.contestSubmission.count({
            where: { contestId, userId },
        })
        const result = await submitContestEntry({
            contestId,
            userId,
            problemId,
            sql: "SELECT * FROM t ORDER BY x",
            dialect: "DUCKDB",
            idempotencyKey: "k1",
            ipHash: "ip-1",
            userAgent: "test-ua",
        })
        const after = await prisma.contestSubmission.count({
            where: { contestId, userId },
        })

        assert.equal(result.verdict, "ACCEPTED")
        assert.equal(after, before)
    })

    it("second accept with a new idempotency key does not double count", async () => {
        const result = await submitContestEntry({
            contestId,
            userId,
            problemId,
            sql: "SELECT * FROM t ORDER BY x",
            dialect: "DUCKDB",
            idempotencyKey: "k2",
            ipHash: "ip-1",
            userAgent: "test-ua",
        })

        assert.equal(result.verdict, "ACCEPTED")
        const leaderboard = await prisma.contestLeaderboardEntry.findUnique({
            where: { contestId_userId: { contestId, userId } },
        })
        assert.equal(leaderboard?.solvedCount, 1)
        assert.equal(leaderboard?.points, 3)
        assert.equal(
            await prisma.contestProblemSolve.count({
                where: { contestId, userId, problemId },
            }),
            1,
        )
    })

    it("WRONG_ANSWER increments attempt counter without a solve row", async () => {
        const result = await submitContestEntry({
            contestId,
            userId,
            problemId,
            sql: "SELECT 999 AS x",
            dialect: "DUCKDB",
            idempotencyKey: "k3",
            ipHash: "ip-1",
            userAgent: "test-ua",
        })

        assert.equal(result.verdict, "WRONG_ANSWER")
        const submissions = await prisma.contestSubmission.findMany({
            where: { contestId, userId, problemId },
            orderBy: { attemptNumber: "asc" },
        })
        assert.ok(submissions.length >= 3)
        assert.equal(submissions.at(-1)?.verdict, "WRONG_ANSWER")
    })

    it("rejects submit outside the contest window", async () => {
        await prisma.contest.update({
            where: { id: contestId },
            data: { endsAt: new Date(Date.now() - 1_000) },
        })

        await assert.rejects(
            () =>
                submitContestEntry({
                    contestId,
                    userId,
                    problemId,
                    sql: "SELECT * FROM t ORDER BY x",
                    dialect: "DUCKDB",
                    idempotencyKey: "k-late",
                    ipHash: "ip-1",
                    userAgent: "test-ua",
                }),
            /CONTEST_NOT_LIVE/,
        )
    })
})
