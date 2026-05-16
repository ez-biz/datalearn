import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { resolveProblemSolution } from "../lib/solutions"

/**
 * `resolveProblemSolution` is the pure half of `getProblemSolution`
 * (the `"use server"` action). The action does `auth()` and prisma
 * queries; this function takes both as injected dependencies so we
 * can unit-test the branching without spinning up the database.
 */

type FakeProblem = {
    id: string
    dialects: ("DUCKDB" | "POSTGRES")[]
    solutions: Record<string, unknown>
    solutionSql: string | null
} | null

function harness(opts: {
    userId?: string
    problem: FakeProblem
    hasAcceptedSubmission?: boolean
} = { problem: null }) {
    const calls = { findProblem: 0, findSubmission: 0 }
    return {
        calls,
        run: (slug = "test-slug") =>
            resolveProblemSolution({
                userId: opts.userId ?? "u1",
                slug,
                findProblem: async () => {
                    calls.findProblem += 1
                    return opts.problem
                },
                findSubmission: async () => {
                    calls.findSubmission += 1
                    return opts.hasAcceptedSubmission ? { id: "sub-1" } : null
                },
            }),
    }
}

describe("resolveProblemSolution", () => {
    it("returns not-found when the slug has no SQLProblem", async () => {
        const h = harness({ problem: null })
        const result = await h.run()
        assert.deepEqual(result, { found: false, reason: "not-found" })
        assert.equal(h.calls.findProblem, 1)
        assert.equal(
            h.calls.findSubmission,
            0,
            "no submission lookup when problem is missing"
        )
    })

    it("returns not-solved when the problem exists but the user has no ACCEPTED submission", async () => {
        const h = harness({
            problem: {
                id: "p1",
                dialects: ["DUCKDB"],
                solutions: { DUCKDB: "SELECT 1;" },
                solutionSql: null,
            },
            hasAcceptedSubmission: false,
        })
        const result = await h.run()
        assert.deepEqual(result, { found: false, reason: "not-solved" })
        assert.equal(h.calls.findSubmission, 1)
    })

    it("returns the per-dialect solutions when the user has an ACCEPTED submission", async () => {
        const h = harness({
            problem: {
                id: "p1",
                dialects: ["DUCKDB", "POSTGRES"],
                solutions: {
                    DUCKDB: "SELECT * FROM users;",
                    POSTGRES: "SELECT * FROM users;",
                },
                solutionSql: "SELECT * FROM users;", // legacy, ignored when per-dialect present
            },
            hasAcceptedSubmission: true,
        })
        const result = await h.run()
        assert.equal(result.found, true)
        if (!result.found) throw new Error("expected found:true")
        assert.deepEqual(result.solutions, {
            DUCKDB: "SELECT * FROM users;",
            POSTGRES: "SELECT * FROM users;",
        })
    })

    it("falls back to legacy solutionSql for a dialect missing from solutions map", async () => {
        const h = harness({
            problem: {
                id: "p1",
                dialects: ["DUCKDB", "POSTGRES"],
                solutions: { DUCKDB: "SELECT 1 FROM duck;" },
                solutionSql: "SELECT 1;",
            },
            hasAcceptedSubmission: true,
        })
        const result = await h.run()
        if (!result.found) throw new Error("expected found:true")
        assert.equal(result.solutions.DUCKDB, "SELECT 1 FROM duck;")
        assert.equal(result.solutions.POSTGRES, "SELECT 1;")
    })

    it("omits a dialect entirely when neither per-dialect nor legacy solution exists", async () => {
        const h = harness({
            problem: {
                id: "p1",
                dialects: ["DUCKDB", "POSTGRES"],
                solutions: { DUCKDB: "SELECT 1;" },
                solutionSql: null,
            },
            hasAcceptedSubmission: true,
        })
        const result = await h.run()
        if (!result.found) throw new Error("expected found:true")
        assert.deepEqual(Object.keys(result.solutions).sort(), ["DUCKDB"])
    })

    it("ignores per-dialect entries that are not strings or are whitespace-only", async () => {
        const h = harness({
            problem: {
                id: "p1",
                dialects: ["DUCKDB", "POSTGRES"],
                solutions: { DUCKDB: "", POSTGRES: 42 as unknown as string },
                solutionSql: "SELECT 1;",
            },
            hasAcceptedSubmission: true,
        })
        const result = await h.run()
        if (!result.found) throw new Error("expected found:true")
        // Both per-dialect entries are unusable → fall back to legacy
        assert.equal(result.solutions.DUCKDB, "SELECT 1;")
        assert.equal(result.solutions.POSTGRES, "SELECT 1;")
    })

    it("never reveals solutions when hasAcceptedSubmission is false even if the problem record is fully populated", async () => {
        const h = harness({
            problem: {
                id: "p1",
                dialects: ["DUCKDB"],
                solutions: { DUCKDB: "SECRET" },
                solutionSql: "SECRET",
            },
            hasAcceptedSubmission: false,
        })
        const result = await h.run()
        assert.equal(result.found, false)
        if (result.found) throw new Error("solutions leaked to unsolved user")
        assert.equal(result.reason, "not-solved")
    })
})
