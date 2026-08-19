// Unit tests for analytics funnel conversion rates.
// No React, DOM, database, or framework dependencies.
//
// Run: node --import tsx --test scripts/test-analytics-funnel.ts

import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildFunnel } from "../lib/analytics/funnel"

describe("buildFunnel", () => {
    it("calculates conversion rates for 100 to 40 to 10", () => {
        const funnel = buildFunnel([
            { key: "viewed", label: "Viewed", count: 100 },
            { key: "started", label: "Started", count: 40 },
            { key: "completed", label: "Completed", count: 10 },
        ])

        assert.equal(funnel[1].rateFromPrevious, 0.4)
        assert.equal(funnel[1].rateFromStart, 0.4)
        assert.equal(funnel[2].rateFromPrevious, 0.25)
        assert.equal(funnel[2].rateFromStart, 0.1)
    })

    it("marks the first step rates as null", () => {
        const [first] = buildFunnel([
            { key: "viewed", label: "Viewed", count: 100 },
        ])

        assert.equal(first.rateFromPrevious, null)
        assert.equal(first.rateFromStart, null)
    })

    it("uses null rates when a starting or previous count is zero", () => {
        const fromZeroStart = buildFunnel([
            { key: "viewed", label: "Viewed", count: 0 },
            { key: "started", label: "Started", count: 10 },
        ])
        const fromZeroPrevious = buildFunnel([
            { key: "viewed", label: "Viewed", count: 20 },
            { key: "started", label: "Started", count: 0 },
            { key: "completed", label: "Completed", count: 10 },
        ])

        assert.equal(fromZeroStart[1].rateFromPrevious, null)
        assert.equal(fromZeroStart[1].rateFromStart, null)
        assert.equal(fromZeroPrevious[2].rateFromPrevious, null)
        assert.equal(fromZeroPrevious[2].rateFromStart, 0.5)
    })

    it("preserves each input identity field without mutating the input", () => {
        const steps = [
            { key: "viewed", label: "Viewed problems", count: 100 },
            { key: "completed", label: "Completed problems", count: 10 },
        ]
        const original = structuredClone(steps)

        const funnel = buildFunnel(steps)

        assert.deepEqual(steps, original)
        assert.deepEqual(
            funnel.map(({ key, label, count }) => ({ key, label, count })),
            original
        )
    })

    it("maps empty input to an empty funnel", () => {
        assert.deepEqual(buildFunnel([]), [])
    })
})
