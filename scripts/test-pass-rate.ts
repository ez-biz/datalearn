// Unit tests for pass-rate formatting. No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-pass-rate.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatPassRate, passRatePercent } from "../lib/workspace/pass-rate"

describe("formatPassRate", () => {
    it("returns null when nobody has attempted", () => {
        // A brand-new problem must render no chip at all. "0% pass" reads as
        // "nobody can solve this" rather than "nobody has tried".
        assert.equal(formatPassRate(0, 0), null)
    })

    it("returns 0% when there are attempts but no passes", () => {
        assert.equal(formatPassRate(0, 12), "0% pass")
    })

    it("rounds to a whole percent", () => {
        assert.equal(formatPassRate(2, 3), "67% pass")
    })

    it("reports 100% only when every attempt passed", () => {
        assert.equal(formatPassRate(5, 5), "100% pass")
    })

    it("never rounds a non-perfect rate up to 100%", () => {
        // 999/1000 is 99.9%. Displaying "100% pass" next to a failed attempt
        // is a bug report waiting to happen.
        assert.equal(formatPassRate(999, 1000), "99% pass")
    })

    it("never rounds a non-zero rate down to 0%", () => {
        assert.equal(formatPassRate(1, 1000), "1% pass")
    })

    it("returns null on incoherent counters rather than throwing", () => {
        // More accepted than attempted cannot happen, but a bad backfill or a
        // partially-applied migration could produce it. Show nothing rather
        // than "250% pass".
        assert.equal(formatPassRate(5, 2), null)
    })

    it("returns null on negative counters", () => {
        assert.equal(formatPassRate(-1, 10), null)
        assert.equal(formatPassRate(1, -10), null)
    })
})

describe("passRatePercent", () => {
    it("exposes the raw number for callers that format their own label", () => {
        assert.equal(passRatePercent(2, 3), 67)
    })

    it("is null wherever formatPassRate is null", () => {
        assert.equal(passRatePercent(0, 0), null)
        assert.equal(passRatePercent(5, 2), null)
    })

    it("clamps the ends the same way the label does", () => {
        assert.equal(passRatePercent(999, 1000), 99)
        assert.equal(passRatePercent(1, 1000), 1)
    })
})
