// Unit tests for the home dashboard's weak-spots computation.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-weak-spots.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    MIN_ATTEMPTS,
    computeWeakSpots,
    type TaggedSubmission,
} from "../lib/home/weak-spots"

function sub(accepted: boolean, ...tags: string[]): TaggedSubmission {
    return {
        accepted,
        tags: tags.map((slug) => ({ slug, name: slug.replace(/-/g, " ") })),
    }
}

/** n submissions on one tag, `ok` of them accepted. */
function runs(tag: string, n: number, ok: number): TaggedSubmission[] {
    return Array.from({ length: n }, (_, i) => sub(i < ok, tag))
}

describe("computeWeakSpots", () => {
    it("returns nothing when there are no submissions", () => {
        assert.deepEqual(computeWeakSpots([]), [])
    })

    it("ignores a tag with fewer than MIN_ATTEMPTS", () => {
        // One bad attempt does not make a weak spot. Judging a tag on a
        // single submission would put a random topic at the top of the card.
        const out = computeWeakSpots(runs("joins", MIN_ATTEMPTS - 1, 0))
        assert.deepEqual(out, [])
    })

    it("includes a tag once it reaches MIN_ATTEMPTS", () => {
        const out = computeWeakSpots(runs("joins", MIN_ATTEMPTS, 0))
        assert.equal(out.length, 1)
        assert.equal(out[0].slug, "joins")
        assert.equal(out[0].attempts, MIN_ATTEMPTS)
    })

    it("computes pass rate as accepted over attempts", () => {
        const out = computeWeakSpots(runs("joins", 4, 1))
        assert.equal(out[0].accepted, 1)
        assert.equal(out[0].passRate, 25)
    })

    it("orders weakest first", () => {
        const out = computeWeakSpots([
            ...runs("easy-tag", 4, 4),
            ...runs("hard-tag", 4, 1),
        ])
        assert.deepEqual(out.map((w) => w.slug), ["hard-tag", "easy-tag"])
    })

    it("breaks a pass-rate tie by attempts, most-attempted first", () => {
        // Same rate, but the tag you have struggled with more often is the
        // more useful thing to drill.
        const out = computeWeakSpots([
            ...runs("few", 4, 2),
            ...runs("many", 8, 4),
        ])
        assert.deepEqual(out.map((w) => w.slug), ["many", "few"])
    })

    it("counts a submission once per tag it carries", () => {
        const out = computeWeakSpots([
            sub(false, "joins", "windows"),
            sub(false, "joins", "windows"),
            sub(true, "joins", "windows"),
        ])
        assert.deepEqual(out.map((w) => w.attempts), [3, 3])
    })

    it("bands by pass rate", () => {
        const weak = computeWeakSpots(runs("a", 10, 2))[0]
        const mixed = computeWeakSpots(runs("b", 10, 6))[0]
        const strong = computeWeakSpots(runs("c", 10, 9))[0]
        assert.equal(weak.band, "weak")
        assert.equal(mixed.band, "mixed")
        assert.equal(strong.band, "strong")
    })

    it("honours the limit", () => {
        const out = computeWeakSpots(
            [...runs("a", 4, 0), ...runs("b", 4, 1), ...runs("c", 4, 2)],
            2
        )
        assert.equal(out.length, 2)
    })

    it("never rounds a non-perfect rate to 100", () => {
        // 99/100 must not read as mastery.
        const out = computeWeakSpots(runs("a", 100, 99))
        assert.equal(out[0].passRate, 99)
    })

    it("does not mutate the input", () => {
        const input = runs("a", 4, 2)
        const before = input.length
        computeWeakSpots(input)
        assert.equal(input.length, before)
    })
})
