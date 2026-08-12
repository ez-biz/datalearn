// Unit tests for community-approach ordering. No DB, no DOM.
//
// Run: node --import tsx --test scripts/test-approach-sort.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { sortApproaches } from "../lib/workspace/approach-sort"

function a(
    id: string,
    score: number,
    verified: boolean,
    minutes: number
): { id: string; score: number; verified: boolean; createdAt: Date } {
    return {
        id,
        score,
        verified,
        // Fixed epoch base — Date.now() would make the suite time-dependent.
        createdAt: new Date(1_700_000_000_000 + minutes * 60_000),
    }
}

describe("sortApproaches", () => {
    it("ranks by score, highest first", () => {
        const out = sortApproaches([a("low", 1, false, 0), a("high", 9, false, 1)])
        assert.deepEqual(out.map((x) => x.id), ["high", "low"])
    })

    it("puts verified first within an equal score", () => {
        const out = sortApproaches([
            a("plain", 5, false, 0),
            a("verified", 5, true, 1),
        ])
        assert.deepEqual(out.map((x) => x.id), ["verified", "plain"])
    })

    it("does NOT let verification beat a higher score", () => {
        // The verified mark mitigates the open posting gate; it is not a
        // ranking signal. The community's judgement leads.
        const out = sortApproaches([
            a("verified-low", 2, true, 0),
            a("unverified-high", 8, false, 1),
        ])
        assert.deepEqual(out.map((x) => x.id), ["unverified-high", "verified-low"])
    })

    it("breaks a full tie by oldest first, so the order is stable", () => {
        const out = sortApproaches([
            a("newer", 3, true, 10),
            a("older", 3, true, 1),
        ])
        assert.deepEqual(out.map((x) => x.id), ["older", "newer"])
    })

    it("is stable regardless of input order", () => {
        const items = [
            a("b", 5, false, 2),
            a("a", 5, true, 1),
            a("c", 9, false, 3),
        ]
        const forward = sortApproaches(items).map((x) => x.id)
        const backward = sortApproaches([...items].reverse()).map((x) => x.id)
        assert.deepEqual(forward, backward)
        assert.deepEqual(forward, ["c", "a", "b"])
    })

    it("handles negative scores", () => {
        const out = sortApproaches([a("neg", -4, true, 0), a("zero", 0, false, 1)])
        assert.deepEqual(out.map((x) => x.id), ["zero", "neg"])
    })

    it("does not mutate the input", () => {
        const items = [a("b", 1, false, 1), a("a", 9, false, 0)]
        const before = items.map((x) => x.id)
        sortApproaches(items)
        assert.deepEqual(items.map((x) => x.id), before)
    })

    it("returns an empty array unchanged", () => {
        assert.deepEqual(sortApproaches([]), [])
    })
})
