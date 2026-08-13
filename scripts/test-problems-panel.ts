// Unit tests for the problems-panel grouping model. No React, no DOM,
// no database.
//
// Run: node --import tsx --test scripts/test-problems-panel.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    buildPanelGroups,
    type PanelProblem,
} from "../lib/workspace/problems-panel-model"
import { resolveCheckpointPosition } from "../lib/workspace/checkpoint-context"
import type { CatalogProblem } from "../lib/practice/catalog-read"

function p(over: Partial<PanelProblem>): PanelProblem {
    return {
        number: 1,
        slug: "s",
        title: "T",
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

describe("buildPanelGroups — track mode", () => {
    it("labels a module with its 1-based display number", () => {
        // Module.position is 0-indexed. The reader's breadcrumb shows
        // position + 1, and the panel must agree with it — otherwise one
        // module reads as 03 in the panel and 04 in the breadcrumb.
        const groups = buildPanelGroups(
            [p({ moduleId: "m", modulePosition: 0, moduleTitle: "Basics" })],
            "track",
            ""
        )
        assert.equal(groups[0].label, "01 · Basics")
    })

    it("orders groups by module position", () => {
        const groups = buildPanelGroups(
            [
                p({
                    number: 2,
                    moduleId: "m4",
                    modulePosition: 3,
                    moduleTitle: "Window functions",
                }),
                p({
                    number: 1,
                    moduleId: "m3",
                    modulePosition: 2,
                    moduleTitle: "Aggregation",
                }),
            ],
            "track",
            ""
        )
        assert.deepEqual(
            groups.map((g) => g.label),
            ["03 · Aggregation", "04 · Window functions"]
        )
    })

    it("puts problems with no module in a final Not in a track group", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 9, slug: "loose" }),
                p({
                    number: 1,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "Basics",
                }),
            ],
            "track",
            ""
        )
        assert.equal(groups.length, 2)
        assert.equal(groups[1].key, "__ungrouped__")
        assert.equal(groups[1].label, "Not in a track")
    })

    it("orders ungrouped problems by number", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 30, slug: "c" }),
                p({ number: 10, slug: "a" }),
                p({ number: 20, slug: "b" }),
            ],
            "track",
            ""
        )
        assert.deepEqual(
            groups[0].problems.map((x) => x.slug),
            ["a", "b", "c"]
        )
    })

    it("counts done/total per group", () => {
        const groups = buildPanelGroups(
            [
                p({
                    number: 1,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "Basics",
                    solved: true,
                }),
                p({
                    number: 2,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "Basics",
                }),
                p({
                    number: 3,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "Basics",
                }),
            ],
            "track",
            ""
        )
        assert.equal(groups[0].done, 1)
        assert.equal(groups[0].total, 3)
    })

    it("keeps the caller's order within a module", () => {
        // The caller supplies curriculum order; the model must not re-sort
        // by number and silently override it.
        const groups = buildPanelGroups(
            [
                p({ number: 30, slug: "third", moduleId: "m1", modulePosition: 1, moduleTitle: "B" }),
                p({ number: 10, slug: "first", moduleId: "m1", modulePosition: 1, moduleTitle: "B" }),
            ],
            "track",
            ""
        )
        assert.deepEqual(
            groups[0].problems.map((x) => x.slug),
            ["third", "first"]
        )
    })

    it("does not mutate the input array", () => {
        const input = [
            p({ number: 2, slug: "b" }),
            p({ number: 1, slug: "a" }),
        ]
        const before = input.map((x) => x.slug)
        buildPanelGroups(input, "track", "")
        assert.deepEqual(
            input.map((x) => x.slug),
            before
        )
    })
})

describe("buildPanelGroups — todo mode", () => {
    it("drops solved problems", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 1, slug: "done", solved: true }),
                p({ number: 2, slug: "open" }),
            ],
            "todo",
            ""
        )
        const slugs = groups.flatMap((g) => g.problems.map((x) => x.slug))
        assert.deepEqual(slugs, ["open"])
    })

    it("drops a group that empties completely", () => {
        const groups = buildPanelGroups(
            [
                p({
                    number: 1,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "Basics",
                    solved: true,
                }),
            ],
            "todo",
            ""
        )
        assert.deepEqual(groups, [])
    })

    it("keeps totals honest — done/total describe what is shown", () => {
        const groups = buildPanelGroups(
            [
                p({
                    number: 1,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "B",
                    solved: true,
                }),
                p({
                    number: 2,
                    moduleId: "m1",
                    modulePosition: 1,
                    moduleTitle: "B",
                }),
            ],
            "todo",
            ""
        )
        assert.equal(groups[0].total, 1)
        assert.equal(groups[0].done, 0)
    })
})

describe("buildPanelGroups — tags mode", () => {
    it("groups by tag and repeats a problem under each of its tags", () => {
        const groups = buildPanelGroups(
            [p({ number: 1, slug: "both", topicTags: ["joins", "window-functions"] })],
            "tags",
            ""
        )
        assert.deepEqual(
            groups.map((g) => g.key).sort(),
            ["joins", "window-functions"]
        )
    })

    it("puts untagged problems in the ungrouped bucket last", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 1, slug: "bare" }),
                p({ number: 2, slug: "tagged", topicTags: ["joins"] }),
            ],
            "tags",
            ""
        )
        assert.equal(groups[groups.length - 1].key, "__ungrouped__")
    })
})

describe("buildPanelGroups — filter", () => {
    it("matches title case-insensitively", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 1, slug: "a", title: "Second highest salary" }),
                p({ number: 2, slug: "b", title: "Duplicate emails" }),
            ],
            "track",
            "SALARY"
        )
        assert.deepEqual(
            groups[0].problems.map((x) => x.slug),
            ["a"]
        )
    })

    it("matches the problem number", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 247, slug: "a", title: "Second highest salary" }),
                p({ number: 119, slug: "b", title: "Duplicate emails" }),
            ],
            "track",
            "247"
        )
        assert.deepEqual(
            groups[0].problems.map((x) => x.slug),
            ["a"]
        )
    })

    it("returns no groups when nothing matches", () => {
        const groups = buildPanelGroups([p({ title: "Joins" })], "track", "zzz")
        assert.deepEqual(groups, [])
    })

    it("ignores surrounding whitespace", () => {
        const groups = buildPanelGroups(
            [p({ slug: "a", title: "Joins" })],
            "track",
            "  joins  "
        )
        assert.equal(groups[0].problems.length, 1)
    })

    it("filters before grouping, so done/total reflect the filtered set", () => {
        const groups = buildPanelGroups(
            [
                p({ number: 1, slug: "a", title: "Joins", moduleId: "m1", modulePosition: 1, moduleTitle: "B", solved: true }),
                p({ number: 2, slug: "b", title: "Windows", moduleId: "m1", modulePosition: 1, moduleTitle: "B" }),
            ],
            "track",
            "joins"
        )
        assert.equal(groups[0].total, 1)
        assert.equal(groups[0].done, 1)
    })
})

describe("resolveCheckpointPosition", () => {
    const siblings = [
        { problemSlug: "a", position: 0 },
        { problemSlug: "b", position: 1 },
        { problemSlug: "c", position: 2 },
    ]

    it("is 1-based for display", () => {
        const r = resolveCheckpointPosition(siblings, "a")!
        assert.equal(r.index, 1)
        assert.equal(r.total, 3)
    })

    it("points at the next sibling by position", () => {
        assert.equal(
            resolveCheckpointPosition(siblings, "b")!.nextProblemSlug,
            "c"
        )
    })

    it("has no next on the last checkpoint", () => {
        assert.equal(
            resolveCheckpointPosition(siblings, "c")!.nextProblemSlug,
            null
        )
    })

    it("sorts by position, not by input order", () => {
        const shuffled = [siblings[2], siblings[0], siblings[1]]
        assert.equal(
            resolveCheckpointPosition(shuffled, "a")!.nextProblemSlug,
            "b"
        )
    })

    it("returns null for a problem that is not a sibling", () => {
        assert.equal(resolveCheckpointPosition(siblings, "zzz"), null)
    })

    it("handles a lone checkpoint", () => {
        const r = resolveCheckpointPosition([{ problemSlug: "only", position: 0 }], "only")!
        assert.equal(r.index, 1)
        assert.equal(r.total, 1)
        assert.equal(r.nextProblemSlug, null)
    })

    it("does not mutate the caller's array", () => {
        const shuffled = [siblings[2], siblings[0], siblings[1]]
        const before = shuffled.map((s) => s.problemSlug)
        resolveCheckpointPosition(shuffled, "a")
        assert.deepEqual(
            shuffled.map((s) => s.problemSlug),
            before
        )
    })
})

describe("CatalogProblem powers the panel model", () => {
    it("is structurally usable as a PanelProblem", () => {
        // A compile-time guarantee expressed as a runtime no-op: if the two
        // types diverge, tsc fails before this test ever runs.
        const row: CatalogProblem = {
            number: 1,
            slug: "s",
            title: "T",
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
        }
        const groups = buildPanelGroups([row], "track", "")
        assert.equal(groups[0].problems[0].slug, "s")
    })
})
