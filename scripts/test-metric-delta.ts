// Unit tests for admin metric deltas.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-metric-delta.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeDelta } from "../lib/admin/metric-delta"

describe("computeDelta", () => {
    it("reports growth", () => {
        assert.deepEqual(computeDelta(12, 8), { change: 4, direction: "up" })
    })

    it("reports regression", () => {
        assert.deepEqual(computeDelta(8, 12), { change: -4, direction: "down" })
    })

    it("reports no movement as flat, not as absent", () => {
        assert.deepEqual(computeDelta(5, 5), { change: 0, direction: "flat" })
    })

    it("returns null when there is no historical basis", () => {
        assert.equal(computeDelta(5, null), null)
    })

    it("treats a zero previous period as real, not missing", () => {
        assert.deepEqual(computeDelta(3, 0), { change: 3, direction: "up" })
    })
})
