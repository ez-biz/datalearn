// Unit tests for the module screen's pure logic. No DOM, no database.
//
// Run: node --import tsx --test scripts/test-module-model.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    lessonState,
    moduleFacts,
    resumeLesson,
} from "../lib/learn/module-model"
import type {
    CurriculumLesson,
    CurriculumModule,
} from "../lib/curriculum-read"

function lesson(over: Partial<CurriculumLesson>): CurriculumLesson {
    return {
        articleId: "a",
        slug: "l",
        title: "L",
        readingMinutes: 5,
        completed: false,
        checkpoints: [],
        ...over,
    }
}

function mod(lessons: CurriculumLesson[]): CurriculumModule {
    return {
        id: "m",
        slug: "m",
        name: "Module",
        description: "",
        position: 0,
        unlocked: true,
        lessons,
        rollup: {
            moduleId: "m",
            lessonsDone: lessons.filter((l) => l.completed).length,
            lessonsTotal: lessons.length,
            problemsDone: 0,
            problemsTotal: 0,
            percent: 0,
        },
    }
}

describe("resumeLesson", () => {
    it("points at the first incomplete lesson", () => {
        const m = mod([
            lesson({ slug: "one", completed: true }),
            lesson({ slug: "two" }),
            lesson({ slug: "three" }),
        ])
        assert.equal(resumeLesson(m)?.slug, "two")
    })

    it("points at the first lesson when nothing is started", () => {
        const m = mod([lesson({ slug: "one" }), lesson({ slug: "two" })])
        assert.equal(resumeLesson(m)?.slug, "one")
    })

    it("falls back to the first lesson when the module is complete", () => {
        // "Resume" on a finished module should re-read it, not vanish.
        const m = mod([
            lesson({ slug: "one", completed: true }),
            lesson({ slug: "two", completed: true }),
        ])
        assert.equal(resumeLesson(m)?.slug, "one")
    })

    it("returns null for a module with no lessons", () => {
        assert.equal(resumeLesson(mod([])), null)
    })

    it("ignores a completed lesson that follows an incomplete one", () => {
        const m = mod([
            lesson({ slug: "one" }),
            lesson({ slug: "two", completed: true }),
        ])
        assert.equal(resumeLesson(m)?.slug, "one")
    })
})

describe("lessonState", () => {
    it("is done when completed, even if it is the resume target", () => {
        assert.equal(lessonState(lesson({ completed: true }), true), "done")
    })

    it("is in-progress for the resume target", () => {
        assert.equal(lessonState(lesson({}), true), "in-progress")
    })

    it("is todo otherwise", () => {
        assert.equal(lessonState(lesson({}), false), "todo")
    })
})

describe("moduleFacts", () => {
    it("sums reading minutes across lessons", () => {
        const m = mod([
            lesson({ readingMinutes: 5 }),
            lesson({ readingMinutes: 7 }),
        ])
        assert.equal(moduleFacts(m).readingMinutes, 12)
    })

    it("treats a null readingMinutes as zero rather than NaN", () => {
        const m = mod([
            lesson({ readingMinutes: null }),
            lesson({ readingMinutes: 4 }),
        ])
        assert.equal(moduleFacts(m).readingMinutes, 4)
    })

    it("counts checkpoints across every lesson", () => {
        const cp = {
            problemId: "p",
            number: 1,
            slug: "s",
            title: "T",
            difficulty: "EASY" as const,
            solved: false,
        }
        const m = mod([
            lesson({ checkpoints: [cp, cp] }),
            lesson({ checkpoints: [cp] }),
        ])
        assert.equal(moduleFacts(m).problemCount, 3)
    })

    it("is zero for an empty module rather than throwing", () => {
        assert.deepEqual(moduleFacts(mod([])), {
            readingMinutes: 0,
            problemCount: 0,
        })
    })
})
