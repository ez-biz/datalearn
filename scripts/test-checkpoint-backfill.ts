// Unit tests for the checkpoint backfill planner. Pure — no database.
//
// Run: node --import tsx --test scripts/test-checkpoint-backfill.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { planCheckpointBackfill } from "../lib/checkpoint-backfill"

const d = (iso: string) => new Date(iso)

describe("planCheckpointBackfill", () => {
    it("creates one checkpoint per unambiguous pair", () => {
        const plan = planCheckpointBackfill([
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
            { articleId: "a2", articleCreatedAt: d("2026-01-02"), problemId: "p2" },
        ])
        assert.equal(plan.create.length, 2)
        assert.equal(plan.skipped.length, 0)
    })

    it("numbers positions from 0 within an article", () => {
        const plan = planCheckpointBackfill([
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p2" },
            { articleId: "a1", articleCreatedAt: d("2026-01-01"), problemId: "p3" },
        ])
        assert.deepEqual(plan.create.map((c) => c.position), [0, 1, 2])
    })

    it("keeps the earliest article when a problem is linked to two", () => {
        const plan = planCheckpointBackfill([
            { articleId: "later", articleCreatedAt: d("2026-02-01"), problemId: "p1" },
            { articleId: "earlier", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
        ])
        assert.equal(plan.create.length, 1)
        assert.equal(plan.create[0].articleId, "earlier")
    })

    it("REPORTS the dropped pair rather than discarding it silently", () => {
        const plan = planCheckpointBackfill([
            { articleId: "later", articleCreatedAt: d("2026-02-01"), problemId: "p1" },
            { articleId: "earlier", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
        ])
        assert.deepEqual(plan.skipped, [
            { problemId: "p1", keptArticleId: "earlier", droppedArticleId: "later" },
        ])
    })

    it("reports every dropped article when a problem is linked to three", () => {
        const plan = planCheckpointBackfill([
            { articleId: "a", articleCreatedAt: d("2026-01-01"), problemId: "p1" },
            { articleId: "b", articleCreatedAt: d("2026-01-02"), problemId: "p1" },
            { articleId: "c", articleCreatedAt: d("2026-01-03"), problemId: "p1" },
        ])
        assert.equal(plan.create.length, 1)
        assert.equal(plan.skipped.length, 2)
        assert.deepEqual(
            plan.skipped.map((s) => s.droppedArticleId).sort(),
            ["b", "c"],
        )
    })

    it("breaks a createdAt tie deterministically by articleId", () => {
        const same = d("2026-01-01")
        const plan = planCheckpointBackfill([
            { articleId: "zzz", articleCreatedAt: same, problemId: "p1" },
            { articleId: "aaa", articleCreatedAt: same, problemId: "p1" },
        ])
        assert.equal(plan.create[0].articleId, "aaa")
    })

    it("returns an empty plan for no pairs", () => {
        const plan = planCheckpointBackfill([])
        assert.deepEqual(plan, { create: [], skipped: [] })
    })
})
