// Unit tests for the tracks index's pure resume logic. No DOM, no database.
//
// Run: node --import tsx --test scripts/test-tracks-model.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { findResume, type ResumeModule } from "../lib/learn/tracks-model"
import { rollUpItems } from "../lib/learn/tracks-read"

function mod(
    slug: string,
    lessons: Array<{ slug: string; completed: boolean }>,
): ResumeModule {
    return { slug, lessons }
}

describe("findResume", () => {
    it("finds the first incomplete lesson across modules in position order", () => {
        const modules = [
            mod("m1", [
                { slug: "l1", completed: true },
                { slug: "l2", completed: false },
            ]),
            mod("m2", [{ slug: "l3", completed: false }]),
        ]
        assert.deepEqual(findResume(modules), { moduleSlug: "m1", lessonSlug: "l2" })
    })

    it("returns null when every lesson in every module is complete", () => {
        const modules = [
            mod("m1", [{ slug: "l1", completed: true }]),
            mod("m2", [
                { slug: "l2", completed: true },
                { slug: "l3", completed: true },
            ]),
        ]
        assert.equal(findResume(modules), null)
    })

    it("returns null when the track has no lessons at all", () => {
        assert.equal(findResume([]), null)
        assert.equal(findResume([mod("m1", [])]), null)
    })

    it("does not stop scanning at the first complete module", () => {
        // The bug this guards: a naive scan that returns as soon as it finds
        // ANY complete lesson (rather than continuing past a fully-complete
        // module to the next one) would miss m2's incomplete lesson.
        const modules = [
            mod("m1", [{ slug: "l1", completed: true }]),
            mod("m2", [
                { slug: "l2", completed: true },
                { slug: "l3", completed: false },
            ]),
            mod("m3", [{ slug: "l4", completed: false }]),
        ]
        assert.deepEqual(findResume(modules), { moduleSlug: "m2", lessonSlug: "l3" })
    })
})

describe("rollUpItems — the TrackItem fallback", () => {
    // Every published track on production at the v0.9.0 release was
    // item-only. Before the fallback the index reported 0/0 for all of them
    // while their detail pages listed full study sequences.
    const items = [
        { problem: { id: "a" } },
        { problem: { id: "b" } },
        { problem: { id: "c" } },
    ]

    it("counts every item as a problem and no lessons", () => {
        const r = rollUpItems(items, new Set())
        assert.equal(r.problemsTotal, 3)
        assert.equal(r.lessonsTotal, 0)
        assert.equal(r.problemsDone, 0)
        assert.equal(r.percent, 0)
    })

    it("counts solved items and rounds the percentage", () => {
        const r = rollUpItems(items, new Set(["a", "b"]))
        assert.equal(r.problemsDone, 2)
        assert.equal(r.percent, 67)
    })

    it("is 100% when every item is solved", () => {
        assert.equal(rollUpItems(items, new Set(["a", "b", "c"])).percent, 100)
    })

    it("is 0%, not NaN, for a track with no items", () => {
        const r = rollUpItems([], new Set())
        assert.equal(r.percent, 0)
        assert.equal(r.problemsTotal, 0)
    })
})
