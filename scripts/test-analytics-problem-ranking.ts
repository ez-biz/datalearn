// Unit tests for per-problem acceptance ranking.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-problem-ranking.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    acceptanceRate,
    rankByAcceptance,
} from "../lib/analytics/problem-ranking"

const problem = (number: number, attempts: number, accepted: number) => ({
    number,
    attempts,
    accepted,
})

describe("acceptanceRate", () => {
    it("returns the ratio as a share from 0 to 1", () => {
        assert.equal(acceptanceRate({ attempts: 10, accepted: 4 }), 0.4)
    })

    // The trap: 0/0 is NaN, and treating it as 0 would rank every untried
    // problem as the worst on the platform.
    it("returns null for a problem with no attempts, never 0 or NaN", () => {
        assert.equal(acceptanceRate({ attempts: 0, accepted: 0 }), null)
    })

    it("returns a genuine zero when a problem was attempted and never solved", () => {
        assert.equal(acceptanceRate({ attempts: 7, accepted: 0 }), 0)
    })
})

describe("rankByAcceptance", () => {
    it("puts the worst acceptance rate first — the table exists to find broken problems", () => {
        const ranked = rankByAcceptance([
            problem(1, 10, 9),
            problem(2, 10, 1),
            problem(3, 10, 5),
        ])
        assert.deepEqual(
            ranked.map((p) => p.number),
            [2, 3, 1]
        )
    })

    it("ranks untried problems last rather than as 0% — they are unknown, not bad", () => {
        const ranked = rankByAcceptance([
            problem(1, 0, 0),
            problem(2, 10, 0),
            problem(3, 10, 8),
        ])
        assert.deepEqual(
            ranked.map((p) => p.number),
            [2, 3, 1]
        )
    })

    it("breaks equal rates by attempt count, so the better-evidenced problem leads", () => {
        const ranked = rankByAcceptance([
            problem(1, 4, 2),
            problem(2, 100, 50),
        ])
        assert.deepEqual(
            ranked.map((p) => p.number),
            [2, 1]
        )
    })

    it("orders untried problems by number so the tail is stable", () => {
        const ranked = rankByAcceptance([
            problem(9, 0, 0),
            problem(3, 0, 0),
            problem(6, 0, 0),
        ])
        assert.deepEqual(
            ranked.map((p) => p.number),
            [3, 6, 9]
        )
    })

    it("does not mutate the input array", () => {
        const input = [problem(1, 10, 9), problem(2, 10, 1)]
        const before = input.map((p) => p.number)
        rankByAcceptance(input)
        assert.deepEqual(
            input.map((p) => p.number),
            before
        )
    })

    it("returns an empty array unchanged", () => {
        assert.deepEqual(rankByAcceptance([]), [])
    })
})
