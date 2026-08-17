// Unit tests for the signed-in home's "which track do we feature" choice.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-active-track.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    pickActiveTrack,
    type ActiveTrackCandidate,
} from "../lib/home/active-track"

// Fixed dates only — never a bare `new Date()` in a test, same discipline
// as scripts/test-weak-spots.ts and scripts/test-today-plan.ts.
const OLDER = new Date("2026-01-01T00:00:00.000Z")
const NEWER = new Date("2026-06-01T00:00:00.000Z")
const NEWEST = new Date("2026-08-01T00:00:00.000Z")

type Track = ActiveTrackCandidate & { slug: string }

function track(
    slug: string,
    percent: number,
    lastActivityAt: Date | null
): Track {
    return { slug, rollup: { percent }, lastActivityAt }
}

describe("pickActiveTrack — finished vs. in progress", () => {
    it("prefers a track with work left over a finished one, even when the finished track was touched more recently", () => {
        const finished = track("finished", 100, NEWEST)
        const inProgress = track("in-progress", 40, OLDER)
        const result = pickActiveTrack([finished, inProgress])
        assert.equal(result?.slug, "in-progress")
    })

    it("still returns a track, not null, when every track is finished", () => {
        const a = track("a", 100, OLDER)
        const b = track("b", 100, NEWEST)
        const result = pickActiveTrack([a, b])
        assert.ok(result !== null)
        // Among finished tracks, the most recently active still wins.
        assert.equal(result?.slug, "b")
    })
})

describe("pickActiveTrack — recency over percent", () => {
    it("a more recently touched track beats a higher-percent one", () => {
        const highPercent = track("high-percent", 80, OLDER)
        const recentlyTouched = track("recently-touched", 20, NEWEST)
        const result = pickActiveTrack([highPercent, recentlyTouched])
        assert.equal(result?.slug, "recently-touched")
    })

    it("breaks a lastActivityAt tie by keeping the earlier candidate in array order", () => {
        const first = track("first", 30, NEWER)
        const second = track("second", 30, NEWER)
        const result = pickActiveTrack([first, second])
        assert.equal(result?.slug, "first")
    })
})

describe("pickActiveTrack — no activity signal", () => {
    it("falls back deterministically to the first track when nothing has ever been touched", () => {
        const a = track("a", 0, null)
        const b = track("b", 0, null)
        const c = track("c", 0, null)
        const result = pickActiveTrack([a, b, c])
        assert.equal(result?.slug, "a")
    })

    it("falls back to the first UNFINISHED track, not a finished-but-touched one, when the unfinished tracks are all untouched", () => {
        // A finished track that was touched must not resurface merely
        // because the in-progress tracks happen to have no activity signal
        // — "work left" still outranks "finished," even here.
        const finishedAndTouched = track("finished-touched", 100, NEWEST)
        const untouchedA = track("untouched-a", 10, null)
        const untouchedB = track("untouched-b", 60, null)
        const result = pickActiveTrack([
            finishedAndTouched,
            untouchedA,
            untouchedB,
        ])
        assert.equal(result?.slug, "untouched-a")
    })
})

describe("pickActiveTrack — empty input", () => {
    it("returns null for an empty track list", () => {
        assert.equal(pickActiveTrack([]), null)
    })
})
