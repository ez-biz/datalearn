// Unit tests for the admin problems-list filter.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-problems-filter.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { filterProblems } from "../lib/admin/problems-filter"

const ROWS = [
    { number: 1, title: "Simple Select", slug: "simple-select", status: "PUBLISHED" },
    { number: 2, title: "Window Functions", slug: "window-functions", status: "DRAFT" },
    { number: 3, title: "Recursive CTE", slug: "recursive-cte", status: "PUBLISHED" },
]

const keys = (rows: typeof ROWS) => rows.map((r) => r.slug)

describe("filterProblems", () => {
    it("returns everything for an empty query and ALL", () => {
        assert.equal(filterProblems(ROWS, "", "ALL").length, 3)
    })

    it("matches title case-insensitively", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "window", "ALL")), ["window-functions"])
    })

    it("matches slug as well as title", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "recursive-cte", "ALL")), ["recursive-cte"])
    })

    it("ignores surrounding whitespace", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "  window  ", "ALL")), ["window-functions"])
    })

    it("filters by status", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "", "DRAFT")), ["window-functions"])
    })

    it("narrows on both together", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "e", "PUBLISHED")), [
            "simple-select",
            "recursive-cte",
        ])
    })

    it("returns empty rather than everything when nothing matches", () => {
        assert.deepEqual(filterProblems(ROWS, "zzz", "ALL"), [])
    })
})
