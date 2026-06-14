import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    excludeLockedProblems,
    isProblemLocked,
    lockProblemsForContest,
    unlockProblemsForContest,
} from "../lib/contest-locks"

const PREFIX = "contest-locks-test-"

let pool: pg.Pool
let prisma: PrismaClient
let userId: string
let schemaId: string
let problemId: string
let contestId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for contest lock tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

    await cleanup()

    const user = await prisma.user.create({
        data: { email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    })
    userId = user.id

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (x INT);" },
    })
    schemaId = schema.id

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 40_000,
            slug: `${PREFIX}p1`,
            title: `${PREFIX}P1`,
            description: "x",
            schemaDescription: "test schema",
            difficulty: "EASY",
            schemaId,
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
            expectedOutput: "[]",
            expectedOutputs: { DUCKDB: "[]" },
            solutionSql: "SELECT 1;",
            solutions: { DUCKDB: "SELECT 1;" },
        },
    })
    problemId = problem.id

    const contest = await prisma.contest.create({
        data: {
            slug: `${PREFIX}c1`,
            title: `${PREFIX}C1`,
            description: "x",
            kind: "WEEKLY",
            status: "SCHEDULED",
            startsAt: new Date(Date.now() + 60_000),
            endsAt: new Date(Date.now() + 120_000),
            durationMinutes: 1,
            createdById: userId,
        },
    })
    contestId = contest.id
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end().catch(() => {})
})

async function cleanup() {
    await prisma?.contestProblemLock.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contestProblem.deleteMany({
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

describe("lockProblemsForContest", () => {
    it("creates a lock row scoped to the contest", async () => {
        await lockProblemsForContest(prisma, contestId, [problemId])
        assert.equal(await isProblemLocked(prisma, problemId), true)
    })

    it("is idempotent for the same problem and contest", async () => {
        await lockProblemsForContest(prisma, contestId, [problemId])
        const count = await prisma.contestProblemLock.count({
            where: { problemId },
        })
        assert.equal(count, 1)
    })

    it("rejects locking a problem already locked by a different contest", async () => {
        const other = await prisma.contest.create({
            data: {
                slug: `${PREFIX}c2`,
                title: `${PREFIX}C2`,
                description: "x",
                kind: "WEEKLY",
                status: "SCHEDULED",
                startsAt: new Date(Date.now() + 60_000),
                endsAt: new Date(Date.now() + 120_000),
                durationMinutes: 1,
                createdById: userId,
            },
        })
        await assert.rejects(
            () => lockProblemsForContest(prisma, other.id, [problemId]),
            /already locked/
        )
    })
})

describe("excludeLockedProblems", () => {
    it("filters locked problems out of findMany queries", async () => {
        const rows = await prisma.sQLProblem.findMany({
            where: excludeLockedProblems({ status: "PUBLISHED" }),
            select: { id: true },
        })
        assert.equal(rows.some((row) => row.id === problemId), false)
    })

    it("does not hide problems behind expired lock rows", async () => {
        await prisma.contestProblemLock.update({
            where: { problemId },
            data: { unlocksAt: new Date(Date.now() - 60_000) },
        })
        assert.equal(await isProblemLocked(prisma, problemId), false)
        const rows = await prisma.sQLProblem.findMany({
            where: excludeLockedProblems({ status: "PUBLISHED" }),
            select: { id: true },
        })
        assert.equal(rows.some((row) => row.id === problemId), true)
    })
})

describe("unlockProblemsForContest", () => {
    it("removes the lock and the problem becomes visible again", async () => {
        await unlockProblemsForContest(prisma, contestId)
        assert.equal(await isProblemLocked(prisma, problemId), false)
        const rows = await prisma.sQLProblem.findMany({
            where: excludeLockedProblems({ status: "PUBLISHED" }),
            select: { id: true },
        })
        assert.equal(rows.some((row) => row.id === problemId), true)
    })
})
