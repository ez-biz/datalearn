// node:test unit tests for lib/profile-stats. Zero new deps.
// Run: npx tsx --test scripts/test-profile-stats.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    buildHeatmap,
    computeStreaks,
    toDayKey,
} from "../lib/profile-stats"

const FIXED_TODAY = new Date(Date.UTC(2026, 4, 1)) // 2026-05-01 UTC

describe("toDayKey", () => {
    it("formats UTC date as YYYY-MM-DD with zero-padding", () => {
        assert.equal(
            toDayKey(new Date(Date.UTC(2026, 0, 5, 12))),
            "2026-01-05"
        )
        assert.equal(
            toDayKey(new Date(Date.UTC(2026, 11, 31, 23, 59))),
            "2026-12-31"
        )
    })

    it("uses UTC, not local time", () => {
        // 2026-05-01 23:59 UTC is still 2026-05-01 in UTC bucket terms
        assert.equal(
            toDayKey(new Date(Date.UTC(2026, 4, 1, 23, 59))),
            "2026-05-01"
        )
    })
})

describe("buildHeatmap", () => {
    it("returns exactly windowDays entries, oldest first", () => {
        const series = buildHeatmap([], 365, FIXED_TODAY)
        assert.equal(series.length, 365)
        assert.equal(series[0].date, "2025-05-02")
        assert.equal(series[364].date, "2026-05-01")
    })

    it("counts multiple submissions on the same day", () => {
        const dates = [
            new Date(Date.UTC(2026, 3, 28, 10)),
            new Date(Date.UTC(2026, 3, 28, 14)),
            new Date(Date.UTC(2026, 3, 28, 21)),
        ]
        const series = buildHeatmap(dates, 365, FIXED_TODAY)
        const day = series.find((d) => d.date === "2026-04-28")!
        assert.equal(day.count, 3)
    })

    it("days with no submissions get count=0", () => {
        const series = buildHeatmap([], 7, FIXED_TODAY)
        for (const d of series) {
            assert.equal(d.count, 0)
        }
    })

    it("ignores submissions outside the window", () => {
        const old = new Date(Date.UTC(2024, 0, 1)) // > 1 year ago
        const series = buildHeatmap([old], 365, FIXED_TODAY)
        const total = series.reduce((sum, d) => sum + d.count, 0)
        assert.equal(total, 0)
    })
})

describe("computeStreaks", () => {
    it("returns zeros for an all-empty series", () => {
        const series = buildHeatmap([], 30, FIXED_TODAY)
        const s = computeStreaks(series)
        assert.deepEqual(s, { current: 0, longest: 0, lastActiveDate: null })
    })

    it("counts a single-day current streak when today has activity", () => {
        const series = buildHeatmap(
            [new Date(Date.UTC(2026, 4, 1, 10))],
            30,
            FIXED_TODAY
        )
        const s = computeStreaks(series)
        assert.equal(s.current, 1)
        assert.equal(s.longest, 1)
        assert.equal(s.lastActiveDate, "2026-05-01")
    })

    it("today empty but yesterday active counts toward current (grace)", () => {
        const series = buildHeatmap(
            [new Date(Date.UTC(2026, 3, 30, 10))], // yesterday
            30,
            FIXED_TODAY
        )
        const s = computeStreaks(series)
        assert.equal(s.current, 1)
        assert.equal(s.lastActiveDate, "2026-04-30")
    })

    it("breaks current streak after one missed day past yesterday", () => {
        // Day before yesterday active, yesterday empty, today empty
        const series = buildHeatmap(
            [new Date(Date.UTC(2026, 3, 29, 10))],
            30,
            FIXED_TODAY
        )
        const s = computeStreaks(series)
        assert.equal(s.current, 0)
        assert.equal(s.longest, 1)
    })

    it("computes longest run within the window", () => {
        const dates = [
            // 4-day run
            new Date(Date.UTC(2026, 3, 10)),
            new Date(Date.UTC(2026, 3, 11)),
            new Date(Date.UTC(2026, 3, 12)),
            new Date(Date.UTC(2026, 3, 13)),
            // gap
            // 2-day run
            new Date(Date.UTC(2026, 3, 20)),
            new Date(Date.UTC(2026, 3, 21)),
        ]
        const series = buildHeatmap(dates, 365, FIXED_TODAY)
        const s = computeStreaks(series)
        assert.equal(s.longest, 4)
        assert.equal(s.current, 0)
    })

    it("treats multiple submissions on the same day as one day toward streak", () => {
        const dates = [
            new Date(Date.UTC(2026, 3, 30, 10)),
            new Date(Date.UTC(2026, 3, 30, 14)),
            new Date(Date.UTC(2026, 4, 1, 9)),
            new Date(Date.UTC(2026, 4, 1, 19)),
        ]
        const series = buildHeatmap(dates, 30, FIXED_TODAY)
        const s = computeStreaks(series)
        assert.equal(s.current, 2) // 2026-04-30 + 2026-05-01
        assert.equal(s.longest, 2)
    })
})
