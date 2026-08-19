// Unit tests for analytics delta tone selection.
//
// Pure — no React rendering, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-stat-tile.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { deltaToneFor } from "../lib/analytics/delta-tone"

describe("deltaToneFor", () => {
    it("treats growth as positive for an up-good metric", () => {
        assert.equal(deltaToneFor("up", "up-good"), "positive")
    })

    it("treats decline as negative for an up-good metric", () => {
        assert.equal(deltaToneFor("down", "up-good"), "negative")
    })

    // The defect this module exists to prevent. components/admin/MetricCard
    // hardcodes up -> text-easy (green), so reusing it for a failure count
    // would render "failures up 40%" in the colour that means "good".
    it("treats growth as NEGATIVE for an up-bad metric", () => {
        assert.equal(deltaToneFor("up", "up-bad"), "negative")
    })

    it("treats decline as POSITIVE for an up-bad metric", () => {
        assert.equal(deltaToneFor("down", "up-bad"), "positive")
    })

    it("never colours a neutral metric in either direction", () => {
        assert.equal(deltaToneFor("up", "neutral"), "neutral")
        assert.equal(deltaToneFor("down", "neutral"), "neutral")
    })

    it("treats flat as neutral regardless of polarity", () => {
        assert.equal(deltaToneFor("flat", "up-good"), "neutral")
        assert.equal(deltaToneFor("flat", "up-bad"), "neutral")
        assert.equal(deltaToneFor("flat", "neutral"), "neutral")
    })

    // Guards against an implementation that returns the same tone for both
    // polarities — the two must genuinely disagree on the same direction.
    it("gives opposite tones to opposite polarities on the same direction", () => {
        for (const direction of ["up", "down"] as const) {
            assert.notEqual(
                deltaToneFor(direction, "up-good"),
                deltaToneFor(direction, "up-bad"),
                `polarity must change the tone for direction "${direction}"`
            )
        }
    })
})
