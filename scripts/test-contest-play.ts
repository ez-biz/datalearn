// Unit tests for contest-play pure helpers (no DB, no React).
// Run: node --import tsx --test scripts/test-contest-play.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    formatRemaining,
    gatingFromStatus,
    verdictLabel,
} from "../lib/contests/play"

describe("gatingFromStatus", () => {
    it("status gates apply to everyone; sign-in/registration only gate LIVE", () => {
        assert.equal(gatingFromStatus("SCHEDULED", true, true), "NOT_STARTED")
        assert.equal(gatingFromStatus("CLOSED", true, true), "ENDED")
        assert.equal(gatingFromStatus("LIVE", false, false), "SIGNED_OUT")
        assert.equal(gatingFromStatus("LIVE", true, false), "NOT_REGISTERED")
        assert.equal(gatingFromStatus("LIVE", true, true), "PLAY")
    })
})

describe("verdictLabel", () => {
    it("ACCEPTED includes points; others map to an error/neutral tone", () => {
        assert.deepEqual(verdictLabel("ACCEPTED", 3), {
            text: "Accepted (+3 pts)",
            tone: "success",
        })
        assert.equal(verdictLabel("WRONG_ANSWER", 3).tone, "error")
        assert.equal(verdictLabel("RUNTIME_ERROR", 3).tone, "error")
        assert.equal(verdictLabel("INTERNAL_ERROR", 3).tone, "neutral")
    })
})

describe("formatRemaining", () => {
    it("formats ms as H:MM:SS and clamps negatives to zero", () => {
        assert.equal(formatRemaining(0), "0:00:00")
        assert.equal(formatRemaining(750_000), "0:12:30")
        assert.equal(formatRemaining(3_661_000), "1:01:01")
        assert.equal(formatRemaining(-5_000), "0:00:00")
    })
})
