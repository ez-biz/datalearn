// Unit tests for contest standings pure helpers (no DB).
// Run: node --import tsx --test scripts/test-contest-leaderboard.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatPenalty, toStandingsRows } from "../lib/contests/leaderboard"

describe("formatPenalty", () => {
    it("formats as H:MM:SS with zero-padded minutes and seconds", () => {
        assert.equal(formatPenalty(0), "0:00:00")
        assert.equal(formatPenalty(750), "0:12:30")
        assert.equal(formatPenalty(3661), "1:01:01")
    })
})

describe("toStandingsRows", () => {
    it("assigns 1-based rank by position and preserves input order", () => {
        const rows = toStandingsRows([
            {
                userId: "a",
                points: 8,
                penaltySeconds: 750,
                solvedCount: 3,
                user: { id: "a", name: "Alice" },
            },
            {
                userId: "b",
                points: 5,
                penaltySeconds: 1210,
                solvedCount: 2,
                user: { id: "b", name: null },
            },
        ])
        assert.equal(rows.length, 2)
        assert.deepEqual(
            rows.map((r) => [r.rank, r.userId, r.participant]),
            [
                [1, "a", "Alice"],
                [2, "b", "Anonymous"],
            ]
        )
    })

    it("does not re-sort its input", () => {
        const rows = toStandingsRows([
            {
                userId: "low",
                points: 1,
                penaltySeconds: 10,
                solvedCount: 1,
                user: { id: "low", name: "Low" },
            },
            {
                userId: "high",
                points: 9,
                penaltySeconds: 10,
                solvedCount: 4,
                user: { id: "high", name: "High" },
            },
        ])
        assert.deepEqual(
            rows.map((r) => r.userId),
            ["low", "high"]
        )
    })
})
