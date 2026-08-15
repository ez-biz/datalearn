// Unit tests for problem-form tab identity and error routing.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-form-tabs.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    FORM_TABS,
    tabForField,
    tabsWithErrors,
    firstErroredTab,
} from "../lib/admin/form-tabs"

describe("FORM_TABS", () => {
    it("is the five designed tabs in order", () => {
        assert.deepEqual(FORM_TABS.map((t) => t.id), [
            "basics",
            "schema",
            "solution",
            "hints",
            "curriculum",
        ])
    })
})

describe("tabForField", () => {
    it("routes known fields", () => {
        assert.equal(tabForField("title"), "basics")
        assert.equal(tabForField("slug"), "basics")
        assert.equal(tabForField("schemaId"), "schema")
        assert.equal(tabForField("solutionSql"), "solution")
        assert.equal(tabForField("expectedOutput"), "solution")
        assert.equal(tabForField("hints"), "hints")
        // A FORM field name, not a database column. There is deliberately no
        // lessonId column on SQLProblem — the binding lives in
        // LessonCheckpoint. See Task 11.
        assert.equal(tabForField("curriculumLessonId"), "curriculum")
    })

    it("returns null for an unknown field rather than guessing", () => {
        assert.equal(tabForField("nonexistent"), null)
    })
})

describe("tabsWithErrors", () => {
    it("returns tabs in tab order, not input order", () => {
        assert.deepEqual(tabsWithErrors(["solutionSql", "title"]), ["basics", "solution"])
    })

    it("de-duplicates", () => {
        assert.deepEqual(tabsWithErrors(["title", "slug"]), ["basics"])
    })

    it("ignores unknown fields", () => {
        assert.deepEqual(tabsWithErrors(["nonexistent"]), [])
    })

    it("is empty for no errors", () => {
        assert.deepEqual(tabsWithErrors([]), [])
    })
})

describe("firstErroredTab", () => {
    it("picks the earliest tab in tab order", () => {
        // Both fields must be MAPPED, or this passes for the wrong reason:
        // an unmapped field is ignored, so ordering would never be exercised.
        assert.equal(firstErroredTab(["curriculumLessonId", "title"]), "basics")
    })

    it("returns null when nothing errored", () => {
        assert.equal(firstErroredTab([]), null)
    })
})
