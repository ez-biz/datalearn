// Unit tests for analytics cohort retention.
// No React, DOM, or database.
//
// Run: node --import tsx --test scripts/test-analytics-retention.ts

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { cohortRetention } from "../lib/analytics/retention"

const TODAY = new Date("2026-03-31T12:00:00.000Z")

describe("cohortRetention", () => {
    it("counts activity on the bucket day as retaining one of two users", () => {
        const result = cohortRetention(
            new Map([["2026-03-01", ["active", "inactive"]]]),
            new Map([["active", new Set(["2026-03-08"])]]),
            7,
            TODAY
        )

        assert.deepEqual(result, [
            {
                cohortDay: "2026-03-01",
                cohortSize: 2,
                retained: 1,
                rate: 0.5,
            },
        ])
    })

    it("counts activity after the bucket day as retained", () => {
        const result = cohortRetention(
            new Map([["2026-03-01", ["returning"]]]),
            new Map([["returning", new Set(["2026-03-12"])]]),
            7,
            TODAY
        )

        assert.equal(result[0].retained, 1)
        assert.equal(result[0].rate, 1)
    })

    it("returns null retention and rate for a cohort younger than its bucket", () => {
        const result = cohortRetention(
            new Map([["2026-03-30", ["new-user"]]]),
            new Map(),
            7,
            TODAY
        )

        assert.deepEqual(result[0], {
            cohortDay: "2026-03-30",
            cohortSize: 1,
            retained: null,
            rate: null,
        })
    })

    it("reports a genuine zero when an elapsed cohort has no return activity", () => {
        const result = cohortRetention(
            new Map([["2026-03-01", ["inactive"]]]),
            new Map(),
            7,
            TODAY
        )

        assert.equal(result[0].retained, 0)
        assert.equal(result[0].rate, 0)
    })

    it("treats a bucket day equal to today as elapsed", () => {
        const result = cohortRetention(
            new Map([["2026-03-24", ["inactive"]]]),
            new Map(),
            7,
            TODAY
        )

        assert.equal(result[0].retained, 0)
        assert.equal(result[0].rate, 0)
    })

    it("does not count activity before the bucket day as retained", () => {
        const result = cohortRetention(
            new Map([["2026-03-01", ["early-only"]]]),
            new Map([["early-only", new Set(["2026-03-07"])]]),
            7,
            TODAY
        )

        assert.equal(result[0].retained, 0)
        assert.equal(result[0].rate, 0)
    })

    it("keeps an elapsed empty cohort at size zero with a null rate", () => {
        const result = cohortRetention(
            new Map([["2026-03-01", []]]),
            new Map(),
            7,
            TODAY
        )

        assert.deepEqual(result[0], {
            cohortDay: "2026-03-01",
            cohortSize: 0,
            retained: 0,
            rate: null,
        })
    })

    it("deduplicates cohort user IDs before counting retention", () => {
        const result = cohortRetention(
            new Map([["2026-03-01", ["returning", "returning", "inactive"]]]),
            new Map([["returning", new Set(["2026-03-08"])]]),
            7,
            TODAY
        )

        assert.deepEqual(result[0], {
            cohortDay: "2026-03-01",
            cohortSize: 2,
            retained: 1,
            rate: 0.5,
        })
    })

    it("sorts unsorted cohort input oldest first", () => {
        const result = cohortRetention(
            new Map([
                ["2026-03-20", ["later"]],
                ["2026-03-01", ["earlier"]],
            ]),
            new Map(),
            1,
            TODAY
        )

        assert.deepEqual(
            result.map(({ cohortDay }) => cohortDay),
            ["2026-03-01", "2026-03-20"]
        )
    })
})
