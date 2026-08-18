import "dotenv/config"
import assert from "node:assert/strict"
import { after, before, describe, it } from "node:test"
import { PrismaClient, type MetricSnapshot } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { writeDailySnapshot } from "../lib/analytics/analytics-read"

const PREFIX = "analytics-snapshot-test-"
const DAY = "2099-01-17"
const USER_EMAIL = `${PREFIX}new-user@example.com`

let pool: pg.Pool
let prisma: PrismaClient

function metrics(snapshot: MetricSnapshot) {
    return {
        registeredUsers: snapshot.registeredUsers,
        publishedProblems: snapshot.publishedProblems,
        publishedArticles: snapshot.publishedArticles,
        publishedTracks: snapshot.publishedTracks,
        lessonsInProgress: snapshot.lessonsInProgress,
    }
}

async function cleanup() {
    await prisma?.metricSnapshot.deleteMany({ where: { day: DAY } })
    await prisma?.user.deleteMany({
        where: { email: { startsWith: PREFIX } },
    })
}

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for analytics snapshot tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()
})

after(async () => {
    await cleanup()
    await prisma?.$disconnect()
    await pool?.end().catch(() => {})
})

describe("writeDailySnapshot", () => {
    it("preserves the first snapshot for a day when a later retry sees changed state", async () => {
        await writeDailySnapshot(DAY)
        const first = await prisma.metricSnapshot.findUniqueOrThrow({
            where: { day: DAY },
        })
        const firstMetrics = metrics(first)

        await prisma.user.create({
            data: { email: USER_EMAIL, role: "USER" },
        })

        await writeDailySnapshot(DAY)

        const snapshots = await prisma.metricSnapshot.findMany({
            where: { day: DAY },
        })
        assert.equal(snapshots.length, 1)
        assert.deepEqual(metrics(snapshots[0]), firstMetrics)
    })

    it("allows concurrent writes for one day without creating or rewriting a second snapshot", async () => {
        await writeDailySnapshot(DAY)
        const first = await prisma.metricSnapshot.findUniqueOrThrow({
            where: { day: DAY },
        })
        const firstMetrics = metrics(first)

        await Promise.all(Array.from({ length: 4 }, () => writeDailySnapshot(DAY)))

        const snapshots = await prisma.metricSnapshot.findMany({
            where: { day: DAY },
        })
        assert.equal(snapshots.length, 1)
        assert.deepEqual(metrics(snapshots[0]), firstMetrics)
    })
})
