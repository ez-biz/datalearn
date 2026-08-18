import "dotenv/config"
import assert from "node:assert/strict"
import { test } from "node:test"
import { toDayKey } from "../lib/profile-stats"

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

test("analytics snapshot cron route requires its bearer secret and returns the current UTC day", async () => {
    const unauthorized = await fetch(`${BASE}/api/cron/analytics-snapshot`)
    assert.equal(unauthorized.status, 403)

    const dayBeforeRequest = toDayKey(new Date())
    const authorized = await fetch(`${BASE}/api/cron/analytics-snapshot`, {
        headers: { Authorization: "Bearer analytics-test-secret" },
    })
    const dayAfterRequest = toDayKey(new Date())
    assert.equal(authorized.status, 200)

    const payload = await authorized.json()
    assert.equal(payload.ok, true)
    assert.ok(
        [dayBeforeRequest, dayAfterRequest].includes(payload.day),
        `expected ${String(payload.day)} to be the current UTC day`,
    )
})
