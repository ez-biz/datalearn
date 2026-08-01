// Unit tests for the pure curriculum rollup maths. No database.
//
// Run: node --import tsx --test scripts/test-curriculum-progress.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    clampProgressPercent,
    isModuleUnlocked,
    rollUpModule,
    rollUpTrack,
    type ModuleRollup,
} from "../lib/curriculum-progress"

function mod(
    moduleId: string,
    lessons: Array<boolean>,
    problems: Array<boolean>,
): ModuleRollup {
    return rollUpModule({
        moduleId,
        lessons: lessons.map((completed, i) => ({
            articleId: `${moduleId}-a${i}`,
            completed,
        })),
        problems: problems.map((solved, i) => ({
            problemId: `${moduleId}-p${i}`,
            solved,
        })),
    })
}

describe("rollUpModule", () => {
    it("counts lessons and problems separately", () => {
        const r = mod("m1", [true, false, false], [true, true, false, false])
        assert.equal(r.lessonsDone, 1)
        assert.equal(r.lessonsTotal, 3)
        assert.equal(r.problemsDone, 2)
        assert.equal(r.problemsTotal, 4)
    })

    it("puts problems in the percent denominator", () => {
        // 1 of 3 lessons + 2 of 4 problems = 3 of 7
        const r = mod("m1", [true, false, false], [true, true, false, false])
        assert.equal(r.percent, 43)
    })

    it("is 0 for an empty module rather than NaN", () => {
        const r = mod("empty", [], [])
        assert.equal(r.percent, 0)
        assert.equal(Number.isNaN(r.percent), false)
    })

    it("is 100 when everything is done", () => {
        assert.equal(mod("m1", [true, true], [true]).percent, 100)
    })

    it("is 100 for a lessons-only module with every lesson read", () => {
        assert.equal(mod("m1", [true, true, true], []).percent, 100)
    })
})

describe("rollUpTrack", () => {
    it("sums across modules and recomputes the percent from the totals", () => {
        const t = rollUpTrack([
            mod("m1", [true, true], [true, true]),
            mod("m2", [false, false], [false, false]),
        ])
        assert.equal(t.lessonsDone, 2)
        assert.equal(t.lessonsTotal, 4)
        assert.equal(t.problemsDone, 2)
        assert.equal(t.problemsTotal, 4)
        assert.equal(t.percent, 50)
    })

    it("is 0 for a track with no content", () => {
        assert.equal(rollUpTrack([]).percent, 0)
    })

    it("does not average module percentages", () => {
        // A 1-item 100% module and a 99-item 0% module is 1%, not 50%.
        const t = rollUpTrack([
            mod("small", [true], []),
            mod("big", new Array(99).fill(false), []),
        ])
        assert.equal(t.percent, 1)
    })
})

describe("isModuleUnlocked", () => {
    const modules = [
        mod("m1", [true], []),           // 100%
        mod("m2", [true, false], []),    // 50%
        mod("m3", [false], []),          // 0%
    ]

    it("always unlocks the first module", () => {
        assert.equal(isModuleUnlocked(modules, 0), true)
    })

    it("unlocks a module when the previous one is complete", () => {
        assert.equal(isModuleUnlocked(modules, 1), true)
    })

    it("locks a module when the previous one is incomplete", () => {
        assert.equal(isModuleUnlocked(modules, 2), false)
    })

    it("treats an out-of-range index as locked", () => {
        assert.equal(isModuleUnlocked(modules, 9), false)
    })
})

describe("clampProgressPercent", () => {
    it("never decreases", () => {
        assert.equal(clampProgressPercent(80, 20), 80)
    })

    it("advances when the incoming value is higher", () => {
        assert.equal(clampProgressPercent(20, 80), 80)
    })

    it("clamps above 100", () => {
        assert.equal(clampProgressPercent(0, 140), 100)
    })

    it("clamps below 0", () => {
        assert.equal(clampProgressPercent(0, -5), 0)
    })

    it("rounds fractional input", () => {
        assert.equal(clampProgressPercent(0, 62.4), 62)
    })

    it("clamps an out-of-range existing value down to 100", () => {
        assert.equal(clampProgressPercent(150, 90), 100)
    })

    it("raises a negative existing value to 0", () => {
        assert.equal(clampProgressPercent(-20, 0), 0)
    })

    it("rounds a fractional existing value", () => {
        assert.equal(clampProgressPercent(62.7, 10), 63)
    })
})
