// Unit tests for the practice-catalog facet, filter and sort model.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-catalog-model.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    EMPTY_FILTERS,
    computeFacets,
    filterCatalog,
    type CatalogFilters,
} from "../lib/practice/catalog-model"
import type { CatalogProblem } from "../lib/practice/catalog-read"

function p(over: Partial<CatalogProblem>): CatalogProblem {
    return {
        number: 1,
        slug: "s",
        title: "T",
        description: "",
        difficulty: "EASY",
        solved: false,
        attempted: false,
        moduleId: null,
        modulePosition: null,
        moduleTitle: null,
        topicTags: [],
        companyTags: [],
        dialects: ["DUCKDB"],
        attemptCount: 0,
        acceptedCount: 0,
        createdAt: new Date(1_700_000_000_000),
        ...over,
    }
}

function withFilters(over: Partial<CatalogFilters>): CatalogFilters {
    return { ...EMPTY_FILTERS, ...over }
}

describe("filterCatalog — status", () => {
    it("solved matches only accepted problems", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "tried", attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(rows, withFilters({ status: ["solved"] }), "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["done"])
    })

    it("todo means neither solved nor attempted", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "tried", attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(rows, withFilters({ status: ["todo"] }), "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["fresh"])
    })

    it("attempted excludes solved, so the three statuses partition the catalog", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "tried", attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(rows, withFilters({ status: ["attempted"] }), "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["tried"])
    })

    it("selecting several statuses is a union", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(
            rows,
            withFilters({ status: ["solved", "todo"] }),
            "curriculum"
        )
        assert.equal(out.length, 2)
    })
})

describe("filterCatalog — combining groups", () => {
    it("different groups intersect", () => {
        const rows = [
            p({ slug: "a", difficulty: "EASY", dialects: ["DUCKDB"] }),
            p({ slug: "b", difficulty: "EASY", dialects: ["POSTGRES"] }),
            p({ slug: "c", difficulty: "HARD", dialects: ["DUCKDB"] }),
        ]
        const out = filterCatalog(
            rows,
            withFilters({ difficulty: ["EASY"], engine: ["DUCKDB"] }),
            "curriculum"
        )
        assert.deepEqual(out.map((r) => r.slug), ["a"])
    })

    it("a problem matches an engine facet if it supports it at all", () => {
        const rows = [p({ slug: "both", dialects: ["DUCKDB", "POSTGRES"] })]
        const out = filterCatalog(rows, withFilters({ engine: ["POSTGRES"] }), "curriculum")
        assert.equal(out.length, 1)
    })

    it("topics and companies are separate groups", () => {
        const rows = [
            p({
                slug: "a",
                topicTags: [{ slug: "joins", name: "Joins" }],
                companyTags: [{ slug: "acme", name: "Acme" }],
            }),
            p({ slug: "b", topicTags: [{ slug: "joins", name: "Joins" }] }),
        ]
        const out = filterCatalog(
            rows,
            withFilters({ topics: ["joins"], companies: ["acme"] }),
            "curriculum"
        )
        assert.deepEqual(out.map((r) => r.slug), ["a"])
    })

    it("search matches title case-insensitively or the exact number", () => {
        const rows = [
            p({ number: 247, slug: "a", title: "Second highest salary" }),
            p({ number: 119, slug: "b", title: "Duplicate emails" }),
        ]
        assert.deepEqual(
            filterCatalog(rows, withFilters({ search: "SALARY" }), "curriculum").map((r) => r.slug),
            ["a"]
        )
        assert.deepEqual(
            filterCatalog(rows, withFilters({ search: "119" }), "curriculum").map((r) => r.slug),
            ["b"]
        )
    })

    it("search also matches a phrase found only in the description, not the title", () => {
        // The regression this guards: SP4's rebuild matched title-or-number
        // only, so a learner searching for a phrase from a problem's body
        // (not its title) got zero results. p()'s default description is
        // "", so "employees" must match ONLY the row that overrides it.
        const rows = [
            p({
                number: 1,
                slug: "a",
                title: "Second highest salary",
                description: "Write a query to find employees earning above the median.",
            }),
            p({ number: 2, slug: "b", title: "Duplicate emails" }),
        ]
        assert.deepEqual(
            filterCatalog(rows, withFilters({ search: "employees" }), "curriculum").map(
                (r) => r.slug
            ),
            ["a"]
        )
    })
})

describe("filterCatalog — sorting", () => {
    it("curriculum order sorts by module position then problem number", () => {
        const rows = [
            p({ slug: "m2", number: 5, modulePosition: 1 }),
            p({ slug: "m1b", number: 9, modulePosition: 0 }),
            p({ slug: "m1a", number: 2, modulePosition: 0 }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["m1a", "m1b", "m2"])
    })

    it("curriculum order puts problems with no module last", () => {
        const rows = [
            p({ slug: "loose", number: 1 }),
            p({ slug: "inmodule", number: 99, modulePosition: 3 }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["inmodule", "loose"])
    })

    it("newest sorts by createdAt descending", () => {
        const rows = [
            p({ slug: "old", createdAt: new Date(1_000) }),
            p({ slug: "new", createdAt: new Date(9_000) }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "newest")
        assert.deepEqual(out.map((r) => r.slug), ["new", "old"])
    })

    it("pass rate sorts hardest first and puts unattempted problems last", () => {
        // An unattempted problem has no rate at all. Sorting it as 0% would
        // claim it is the hardest problem in the catalog.
        const rows = [
            p({ slug: "easy", attemptCount: 10, acceptedCount: 9 }),
            p({ slug: "hard", attemptCount: 10, acceptedCount: 1 }),
            p({ slug: "untried" }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "pass-rate")
        assert.deepEqual(out.map((r) => r.slug), ["hard", "easy", "untried"])
    })

    it("does not mutate the input", () => {
        const rows = [p({ slug: "b", number: 2 }), p({ slug: "a", number: 1 })]
        const before = rows.map((r) => r.slug)
        filterCatalog(rows, EMPTY_FILTERS, "newest")
        assert.deepEqual(rows.map((r) => r.slug), before)
    })
})

describe("computeFacets", () => {
    it("counts within a group ignore that group's own selection", () => {
        // THE load-bearing rule. If selecting EASY made the MEDIUM count 0,
        // the rail would tell the learner there is nothing else to pick.
        const rows = [
            p({ slug: "a", difficulty: "EASY" }),
            p({ slug: "b", difficulty: "MEDIUM" }),
            p({ slug: "c", difficulty: "MEDIUM" }),
        ]
        const facets = computeFacets(rows, withFilters({ difficulty: ["EASY"] }))
        const medium = facets.difficulty.find((f) => f.value === "MEDIUM")
        assert.equal(medium?.count, 2)
    })

    it("counts within a group DO reflect other groups' selections", () => {
        const rows = [
            p({ slug: "a", difficulty: "EASY", dialects: ["DUCKDB"] }),
            p({ slug: "b", difficulty: "MEDIUM", dialects: ["POSTGRES"] }),
        ]
        const facets = computeFacets(rows, withFilters({ engine: ["DUCKDB"] }))
        assert.equal(facets.difficulty.find((f) => f.value === "MEDIUM")?.count, 0)
        assert.equal(facets.difficulty.find((f) => f.value === "EASY")?.count, 1)
    })

    it("lists every difficulty even at zero, so options never disappear", () => {
        const facets = computeFacets([p({ difficulty: "EASY" })], EMPTY_FILTERS)
        assert.deepEqual(
            facets.difficulty.map((f) => f.value),
            ["EASY", "MEDIUM", "HARD"]
        )
    })

    it("orders topic and company facets by count descending", () => {
        const rows = [
            p({
                slug: "a",
                topicTags: [
                    { slug: "joins", name: "Joins" },
                    { slug: "windows", name: "Window functions" },
                ],
            }),
            p({ slug: "b", topicTags: [{ slug: "joins", name: "Joins" }] }),
        ]
        const facets = computeFacets(rows, EMPTY_FILTERS)
        assert.deepEqual(facets.topics.map((f) => f.value), ["joins", "windows"])
        assert.equal(facets.topics[0].count, 2)
    })

    it("a facet's label is the tag's display name, not its slug", () => {
        const rows = [
            p({
                slug: "a",
                topicTags: [{ slug: "recursive-cte", name: "Recursive CTE" }],
                companyTags: [{ slug: "stripe", name: "Stripe" }],
            }),
        ]
        const facets = computeFacets(rows, EMPTY_FILTERS)
        assert.deepEqual(facets.topics[0], {
            value: "recursive-cte",
            label: "Recursive CTE",
            count: 1,
        })
        assert.deepEqual(facets.companies[0], {
            value: "stripe",
            label: "Stripe",
            count: 1,
        })
    })
})
