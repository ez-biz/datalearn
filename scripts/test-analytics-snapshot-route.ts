import "dotenv/config"
import assert from "node:assert/strict"
import { after, before, test } from "node:test"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { toDayKey } from "../lib/profile-stats"
import { snapshotDayForRun } from "../lib/analytics/snapshot-day"

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"
const dayBeforeRequest = toDayKey(new Date())
const dayAfterRequest = toDayKey(new Date(Date.now() + 86_400_000))
const existingSnapshots = new Map<string, boolean>()

let pool: pg.Pool
let prisma: PrismaClient

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for analytics snapshot route tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

    for (const day of [dayBeforeRequest, dayAfterRequest]) {
        const snapshot = await prisma.metricSnapshot.findUnique({ where: { day } })
        existingSnapshots.set(day, snapshot !== null)
    }
})

after(async () => {
    for (const [day, existed] of existingSnapshots) {
        if (!existed) {
            await prisma?.metricSnapshot.deleteMany({ where: { day } })
        }
    }

    await prisma?.$disconnect()
    await pool?.end().catch(() => {})
})

test("the snapshot day is captured at the authorized invocation boundary", () => {
    assert.equal(
        snapshotDayForRun(new Date("2026-08-18T23:59:59.999Z")),
        "2026-08-18"
    )
    assert.equal(
        snapshotDayForRun(new Date("2026-08-19T00:00:00.000Z")),
        "2026-08-19"
    )
})

test("analytics snapshot cron route requires its bearer secret and returns the current UTC day", async () => {
    const unauthorized = await fetch(`${BASE}/api/cron/analytics-snapshot`)
    assert.equal(unauthorized.status, 403)

    const incorrectSecret = await fetch(`${BASE}/api/cron/analytics-snapshot`, {
        headers: { Authorization: "Bearer incorrect-secret" },
    })
    assert.equal(incorrectSecret.status, 403)

    const authorized = await fetch(`${BASE}/api/cron/analytics-snapshot`, {
        headers: { Authorization: "Bearer analytics-test-secret" },
    })
    const responseDayAfterRequest = toDayKey(new Date())
    assert.equal(authorized.status, 200)

    const payload = await authorized.json()
    assert.equal(payload.ok, true)
    assert.ok(
        [dayBeforeRequest, responseDayAfterRequest].includes(payload.day),
        `expected ${String(payload.day)} to be the current UTC day`,
    )
})
