// Unit tests for the signed-in home's "Today's plan".
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-today-plan.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildTodayPlan, type PlanInput } from "../lib/home/today-plan"

const RESUME: PlanInput["resume"] = {
    trackSlug: "analyst-interview-prep",
    lessonSlug: "sessionisation",
    lessonTitle: "Sessionising an event stream",
    moduleTitle: "Window functions",
    modulePosition: 3,
}
const DAILY: PlanInput["daily"] = {
    slug: "second-highest-salary",
    title: "Second highest salary",
    difficulty: "MEDIUM",
    solvedToday: false,
}
const NEXT: PlanInput["nextProblem"] = {
    slug: "duplicate-emails",
    title: "Duplicate emails",
    difficulty: "EASY",
}

function input(over: Partial<PlanInput> = {}): PlanInput {
    return { resume: null, daily: null, nextProblem: null, ...over }
}

describe("buildTodayPlan — priority", () => {
    it("puts the lesson first, then daily, then the next problem", () => {
        const rows = buildTodayPlan(
            input({ resume: RESUME, daily: DAILY, nextProblem: NEXT })
        )
        assert.deepEqual(rows.map((r) => r.kind), ["lesson", "daily", "problem"])
    })

    it("never returns more than three rows", () => {
        const rows = buildTodayPlan(
            input({ resume: RESUME, daily: DAILY, nextProblem: NEXT })
        )
        assert.ok(rows.length <= 3)
    })
})

describe("buildTodayPlan — the degraded paths", () => {
    // Production has zero modules and zero lessons, so `resume` is null for
    // every learner there. These are the cases that actually ship today.
    it("works with no curriculum at all", () => {
        const rows = buildTodayPlan(input({ daily: DAILY, nextProblem: NEXT }))
        assert.deepEqual(rows.map((r) => r.kind), ["daily", "problem"])
    })

    it("works with only a next problem", () => {
        const rows = buildTodayPlan(input({ nextProblem: NEXT }))
        assert.deepEqual(rows.map((r) => r.kind), ["problem"])
    })

    it("returns an empty plan when there is nothing to do", () => {
        assert.deepEqual(buildTodayPlan(input()), [])
    })

    it("still lists the daily when it is already solved, marked done", () => {
        // Solved-today is worth showing as a tick rather than hiding — it is
        // the learner's evidence they did the thing.
        const rows = buildTodayPlan(
            input({ daily: { ...DAILY, solvedToday: true } })
        )
        assert.equal(rows.length, 1)
        assert.equal(rows[0].done, true)
    })
})

describe("buildTodayPlan — row contents", () => {
    it("links a lesson to the reader with a 1-based module number", () => {
        // Module.position is 0-indexed; the displayed number is position + 1,
        // matching modulePrefix in components/learn/reader/lesson-nav.ts.
        const [row] = buildTodayPlan(input({ resume: RESUME }))
        assert.equal(
            row.href,
            "/learn/tracks/analyst-interview-prep/sessionisation"
        )
        assert.match(row.meta, /04/)
        assert.equal(row.title, "Sessionising an event stream")
        assert.equal(row.done, false)
    })

    it("links problems to the workspace", () => {
        const rows = buildTodayPlan(input({ daily: DAILY, nextProblem: NEXT }))
        assert.equal(rows[0].href, "/practice/second-highest-salary")
        assert.equal(rows[1].href, "/practice/duplicate-emails")
    })

    it("does not repeat the daily problem as the next problem", () => {
        // Same slug in both slots would render the same row twice.
        const rows = buildTodayPlan(
            input({
                daily: DAILY,
                nextProblem: {
                    slug: DAILY.slug,
                    title: DAILY.title,
                    difficulty: "MEDIUM",
                },
            })
        )
        assert.equal(rows.length, 1)
        assert.equal(rows[0].kind, "daily")
    })
})
