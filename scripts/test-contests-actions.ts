import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { registerContestParticipantUnchecked } from "../lib/contest-registration"
import {
    getContestBySlug,
    listContests,
} from "../actions/contests"

const PREFIX = "contest-actions-test-"

let pool: pg.Pool
let prisma: PrismaClient
let adminId: string
let learnerId: string
let contestId: string
let privateContestId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for contest action tests")
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()

    const admin = await prisma.user.create({
        data: { email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    })
    adminId = admin.id
    const learner = await prisma.user.create({
        data: { email: `${PREFIX}learner@example.com`, role: "USER" },
    })
    learnerId = learner.id

    const scheduled = await prisma.contest.create({
        data: {
            slug: `${PREFIX}sched`,
            title: `${PREFIX}Scheduled`,
            description: "Scheduled contest",
            kind: "WEEKLY",
            status: "SCHEDULED",
            startsAt: new Date(Date.now() + 60_000),
            endsAt: new Date(Date.now() + 120_000),
            durationMinutes: 1,
            createdById: adminId,
        },
    })
    contestId = scheduled.id

    await prisma.contest.create({
        data: {
            slug: `${PREFIX}past`,
            title: `${PREFIX}Past`,
            description: "Past contest",
            kind: "WEEKLY",
            status: "SCHEDULED",
            startsAt: new Date(Date.now() - 120_000),
            endsAt: new Date(Date.now() - 60_000),
            durationMinutes: 1,
            createdById: adminId,
        },
    })

    const privateContest = await prisma.contest.create({
        data: {
            slug: `${PREFIX}private`,
            title: `${PREFIX}Private`,
            description: "Private contest",
            kind: "WEEKLY",
            status: "SCHEDULED",
            startsAt: new Date(Date.now() + 60_000),
            endsAt: new Date(Date.now() + 120_000),
            durationMinutes: 1,
            visibility: "PRIVATE",
            createdById: adminId,
        },
    })
    privateContestId = privateContest.id
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end().catch(() => {})
})

async function cleanup() {
    await prisma?.contestRegistration.deleteMany({
        where: { contest: { slug: { startsWith: PREFIX } } },
    })
    await prisma?.contest.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma?.user.deleteMany({
        where: { email: { startsWith: PREFIX } },
    })
}

describe("listContests", () => {
    it("returns official contests with derived status", async () => {
        const rows = (await listContests()).filter((row) =>
            row.slug.startsWith(PREFIX)
        )
        assert.equal(rows.length, 2)
        assert.equal(rows.find((row) => row.slug.endsWith("sched"))?.status, "SCHEDULED")
        assert.equal(rows.find((row) => row.slug.endsWith("past"))?.status, "CLOSED")
    })
})

describe("getContestBySlug", () => {
    it("returns a scheduled contest without revealing problems", async () => {
        const contest = await getContestBySlug(`${PREFIX}sched`)
        assert.equal(contest?.slug, `${PREFIX}sched`)
        assert.deepEqual(contest?.problems, [])
    })

    it("returns null for private contests", async () => {
        assert.equal(await getContestBySlug(`${PREFIX}private`), null)
    })

    it("returns null for unknown contests", async () => {
        assert.equal(await getContestBySlug(`${PREFIX}missing`), null)
    })
})

describe("registerContestParticipantUnchecked", () => {
    it("registers once and then reports already_registered", async () => {
        assert.deepEqual(
            await registerContestParticipantUnchecked({
                contestId,
                userId: learnerId,
            }),
            { status: "registered" }
        )
        assert.deepEqual(
            await registerContestParticipantUnchecked({
                contestId,
                userId: learnerId,
            }),
            { status: "already_registered" }
        )
    })

    it("rejects private contests", async () => {
        await assert.rejects(
            () =>
                registerContestParticipantUnchecked({
                    contestId: privateContestId,
                    userId: learnerId,
                }),
            /CONTEST_NOT_FOUND/
        )
    })
})
