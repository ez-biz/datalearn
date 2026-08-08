// Unit tests for pure lesson navigation maths. No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-lesson-nav.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    flattenCurriculum,
    findLesson,
    lessonNeighbors,
    modulePrefix,
    lessonBreadcrumb,
} from "../components/learn/reader/lesson-nav"
import { stripLeadingH1 } from "../components/learn/reader/LessonBody"
import type { CurriculumCheckpoint, TrackCurriculum } from "../lib/curriculum-read"

function lesson(
    slug: string,
    completed = false,
    readingMinutes = 4,
    checkpoints: CurriculumCheckpoint[] = [],
) {
    return {
        articleId: `a-${slug}`,
        slug,
        title: slug.replace(/-/g, " "),
        readingMinutes,
        completed,
        checkpoints,
    }
}

function fixture(): TrackCurriculum {
    return {
        trackId: "t1",
        slug: "analyst-interview-prep",
        name: "Analyst Interview Prep",
        rollup: {
            lessonsDone: 1, lessonsTotal: 3,
            problemsDone: 0, problemsTotal: 0, percent: 33,
        },
        modules: [
            {
                id: "m1", slug: "foundations", name: "Foundations",
                description: "", position: 0, unlocked: true,
                lessons: [lesson("select-where", true), lesson("null-is-not-a-value")],
                rollup: {
                    moduleId: "m1", lessonsDone: 1, lessonsTotal: 2,
                    problemsDone: 0, problemsTotal: 0, percent: 50,
                },
            },
            {
                id: "m2", slug: "joins", name: "Joins",
                description: "", position: 1, unlocked: false,
                lessons: [lesson("semi-and-anti-joins")],
                rollup: {
                    moduleId: "m2", lessonsDone: 0, lessonsTotal: 1,
                    problemsDone: 0, problemsTotal: 0, percent: 0,
                },
            },
        ],
    }
}

describe("flattenCurriculum", () => {
    it("returns every lesson in track order with a 0-indexed flat index", () => {
        const flat = flattenCurriculum(fixture())
        assert.equal(flat.length, 3)
        assert.deepEqual(
            flat.map((l) => l.slug),
            ["select-where", "null-is-not-a-value", "semi-and-anti-joins"],
        )
        assert.deepEqual(flat.map((l) => l.flatIndex), [0, 1, 2])
    })

    it("carries module identity onto each lesson", () => {
        const flat = flattenCurriculum(fixture())
        assert.equal(flat[2].moduleSlug, "joins")
        assert.equal(flat[2].moduleName, "Joins")
        assert.equal(flat[2].modulePosition, 1)
        assert.equal(flat[2].lessonInModule, 0)
    })

    it("keeps both occurrences when one article sits in two modules", () => {
        const c = fixture()
        c.modules[1].lessons.push(lesson("select-where", true))
        const flat = flattenCurriculum(c)
        assert.equal(flat.length, 4)
        assert.equal(flat.filter((l) => l.slug === "select-where").length, 2)
    })

    it("is empty for a track with no modules", () => {
        const c = fixture()
        c.modules = []
        assert.deepEqual(flattenCurriculum(c), [])
    })

    it("carries each lesson's payload fields through unchanged", () => {
        const checkpointsA: CurriculumCheckpoint[] = [
            {
                problemId: "p-top-earners",
                number: 12,
                slug: "top-earners",
                title: "Top earners",
                difficulty: "MEDIUM",
                solved: true,
            },
        ]
        const checkpointsB: CurriculumCheckpoint[] = [
            {
                problemId: "p-null-salaries",
                number: 20,
                slug: "null-salaries",
                title: "Null salaries",
                difficulty: "EASY",
                solved: false,
            },
            {
                problemId: "p-coalesce-defaults",
                number: 21,
                slug: "coalesce-defaults",
                title: "Coalesce defaults",
                difficulty: "HARD",
                solved: true,
            },
        ]
        const c = fixture()
        c.modules[0].lessons = [
            lesson("select-where", true, 9, checkpointsA),
            lesson("null-is-not-a-value", false, 2, checkpointsB),
        ]
        const flat = flattenCurriculum(c)

        const first = flat.find((l) => l.slug === "select-where")
        assert.equal(first?.articleId, "a-select-where")
        assert.equal(first?.readingMinutes, 9)
        assert.equal(first?.completed, true)
        assert.deepEqual(first?.checkpoints, checkpointsA)

        const second = flat.find((l) => l.slug === "null-is-not-a-value")
        assert.equal(second?.articleId, "a-null-is-not-a-value")
        assert.equal(second?.readingMinutes, 2)
        assert.equal(second?.completed, false)
        assert.deepEqual(second?.checkpoints, checkpointsB)
    })
})

describe("findLesson", () => {
    it("resolves a slug to its flat entry", () => {
        const flat = flattenCurriculum(fixture())
        assert.equal(findLesson(flat, "null-is-not-a-value")?.flatIndex, 1)
    })

    it("returns null for an unknown slug", () => {
        assert.equal(findLesson(flattenCurriculum(fixture()), "nope"), null)
    })

    it("resolves to the LOWEST module position when an article is in two", () => {
        const c = fixture()
        c.modules[1].lessons.push(lesson("select-where", true))
        const hit = findLesson(flattenCurriculum(c), "select-where")
        assert.equal(hit?.modulePosition, 0)
        assert.equal(hit?.moduleSlug, "foundations")
    })
})

describe("lessonNeighbors", () => {
    it("gives both neighbours in the middle of a track", () => {
        const flat = flattenCurriculum(fixture())
        const { prev, next } = lessonNeighbors(flat, 1)
        assert.equal(prev?.slug, "select-where")
        assert.equal(next?.slug, "semi-and-anti-joins")
    })

    it("has no prev on the first lesson", () => {
        const { prev, next } = lessonNeighbors(flattenCurriculum(fixture()), 0)
        assert.equal(prev, null)
        assert.equal(next?.slug, "null-is-not-a-value")
    })

    it("has no next on the last lesson", () => {
        const { prev, next } = lessonNeighbors(flattenCurriculum(fixture()), 2)
        assert.equal(prev?.slug, "null-is-not-a-value")
        assert.equal(next, null)
    })

    it("returns both null for an out-of-range index", () => {
        const { prev, next } = lessonNeighbors(flattenCurriculum(fixture()), 99)
        assert.equal(prev, null)
        assert.equal(next, null)
    })
})

describe("modulePrefix", () => {
    it("renders a 0-indexed position as a 1-based 2-digit string", () => {
        assert.equal(modulePrefix(0), "01")
        assert.equal(modulePrefix(3), "04")
    })

    it("does not truncate past nine", () => {
        assert.equal(modulePrefix(11), "12")
    })
})

describe("lessonBreadcrumb", () => {
    it("prefixes the module with its display number", () => {
        const flat = flattenCurriculum(fixture())
        const crumb = lessonBreadcrumb("analyst-interview-prep", flat[2])
        assert.deepEqual(crumb, {
            track: "analyst-interview-prep",
            module: "02-joins",
            lesson: "semi-and-anti-joins",
        })
    })
})

describe("stripLeadingH1", () => {
    it("removes a leading H1", () => {
        const out = stripLeadingH1("# Sessionisation\n\nBody text.")
        assert.equal(out, "Body text.")
    })

    it("removes a leading H1 after blank lines", () => {
        const out = stripLeadingH1("\n\n# Sessionisation\n\nBody text.")
        assert.equal(out, "Body text.")
    })

    it("leaves content without a leading H1 alone", () => {
        const md = "Body text.\n\n## A section"
        assert.equal(stripLeadingH1(md), md)
    })

    it("leaves an H2 alone", () => {
        const md = "## A section\n\nBody."
        assert.equal(stripLeadingH1(md), md)
    })

    it("removes ONLY the first H1, keeping later ones", () => {
        const out = stripLeadingH1("# One\n\nBody.\n\n# Two\n\nMore.")
        assert.equal(out, "Body.\n\n# Two\n\nMore.")
    })

    it("does not strip an H1 that appears after body text", () => {
        const md = "Intro.\n\n# Later heading\n\nBody."
        assert.equal(stripLeadingH1(md), md)
    })

    it("handles empty content", () => {
        assert.equal(stripLeadingH1(""), "")
    })
})
