// Unit tests for the pure onboarding entry-point maths. No database.
//
// Run: node --import tsx --test scripts/test-onboarding-entry.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    entryModuleIndex,
    resolveEntryPoint,
    type ModuleLike,
    type SqlLevel,
} from "../lib/onboarding/entry-point"

function mod(slug: string, position: number, lessonCount: number): ModuleLike {
    return {
        slug,
        name: `Module ${slug}`,
        position,
        lessons: Array.from({ length: lessonCount }, (_, i) => ({
            slug: `${slug}-lesson-${i}`,
            title: `${slug} lesson ${i}`,
            readingMinutes: 6,
        })),
    }
}

// The authored track: foundations, joins, aggregation, window-functions,
// interview-patterns.
const FIVE: ModuleLike[] = [
    mod("foundations", 0, 3),
    mod("joins", 1, 4),
    mod("aggregation", 2, 4),
    mod("window-functions", 3, 3),
    mod("interview-patterns", 4, 3),
]

describe("entryModuleIndex", () => {
    it("sends a new learner to the first module", () => {
        assert.equal(entryModuleIndex("NEW", 5), 0)
    })

    it("sends an intermediate learner past the basics", () => {
        assert.equal(entryModuleIndex("INTERMEDIATE", 5), 2)
    })

    it("sends an advanced learner to window functions, not the last module", () => {
        // Landing on the final module would finish the track in one sitting
        // and leave nowhere to go next.
        assert.equal(entryModuleIndex("ADVANCED", 5), 3)
    })

    it("clamps to the last module on a short track", () => {
        assert.equal(entryModuleIndex("ADVANCED", 2), 1)
        assert.equal(entryModuleIndex("INTERMEDIATE", 2), 1)
    })

    it("clamps to the only module on a one-module track", () => {
        assert.equal(entryModuleIndex("ADVANCED", 1), 0)
    })

    it("returns null when there are no modules", () => {
        assert.equal(entryModuleIndex("NEW", 0), null)
    })

    it("handles every level with no fallthrough", () => {
        const levels: SqlLevel[] = ["NEW", "INTERMEDIATE", "ADVANCED"]
        for (const level of levels) {
            const index = entryModuleIndex(level, 5)
            assert.equal(typeof index, "number", `${level} produced no index`)
        }
    })
})

describe("resolveEntryPoint", () => {
    it("returns the first lesson of the target module", () => {
        const entry = resolveEntryPoint("INTERMEDIATE", FIVE)
        assert.equal(entry?.moduleSlug, "aggregation")
        assert.equal(entry?.lessonSlug, "aggregation-lesson-0")
        assert.equal(entry?.lessonCount, 4)
        assert.equal(entry?.modulePosition, 2)
    })

    it("skips forward past an empty target module", () => {
        const modules = [
            mod("foundations", 0, 3),
            mod("joins", 1, 2),
            { ...mod("aggregation", 2, 0) },
            mod("window-functions", 3, 3),
        ]
        const entry = resolveEntryPoint("INTERMEDIATE", modules)
        assert.equal(entry?.moduleSlug, "window-functions")
    })

    it("falls back to an earlier module when every later one is empty", () => {
        const modules = [
            mod("foundations", 0, 3),
            mod("joins", 1, 2),
            { ...mod("aggregation", 2, 0) },
            { ...mod("window-functions", 3, 0) },
        ]
        const entry = resolveEntryPoint("ADVANCED", modules)
        assert.equal(entry?.moduleSlug, "joins")
    })

    it("returns null when no module has a lesson", () => {
        const modules = [mod("foundations", 0, 0), mod("joins", 1, 0)]
        assert.equal(resolveEntryPoint("NEW", modules), null)
    })

    it("returns null for an empty curriculum", () => {
        assert.equal(resolveEntryPoint("NEW", []), null)
    })
})
