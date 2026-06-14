import { beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    _resetJudgeWarmStateForTests,
    submitToJudge,
    warmUpJudge,
} from "../lib/contest-judge"

// Requires the built worker (`npm run build:contest-worker`), like the other
// fork-backed judge tests. The package.json script prefixes the build.

// A real fork (worker load + engine init) is well over 30ms even when the file
// cache is warm; a debounced skip just resolves an already-settled Promise, so
// it returns in single-digit ms. 30ms cleanly separates the two without being
// flaky on a loaded CI box.
const SKIP_BUDGET_MS = 30

async function timed(fn: () => Promise<unknown>): Promise<number> {
    const start = performance.now()
    await fn()
    return performance.now() - start
}

describe("contest judge warm-up", () => {
    beforeEach(() => {
        _resetJudgeWarmStateForTests()
    })

    it("warms the engine so the next submission avoids the cold cliff", async () => {
        await warmUpJudge("DUCKDB")

        const elapsed = await timed(async () => {
            const outcome = await submitToJudge({
                dialect: "DUCKDB",
                userSql: "SELECT 1 AS x",
                hiddenSchemaSql: "SELECT 1;",
                hiddenExpected: [{ x: 1 }],
                ordered: false,
                timeoutMs: 5_000,
            })
            assert.equal(outcome.verdict, "ACCEPTED")
        })

        // The whole point: after warm-up the first real submission runs at
        // steady state, nowhere near the >30s cold-start the audit flagged.
        assert.ok(
            elapsed < 10_000,
            `post-warm submission took ${elapsed.toFixed(0)}ms (expected steady-state, not a cold start)`
        )
    })

    it("dedupes concurrent warm requests into a single in-flight run", async () => {
        const first = warmUpJudge("DUCKDB")
        const second = warmUpJudge("DUCKDB")
        // Same Promise reference == one fork serving both callers, no storm.
        assert.equal(first, second)
        await Promise.all([first, second])
    })

    it("skips re-warming within the TTL window", async () => {
        await warmUpJudge("DUCKDB")
        const skip = await timed(() => warmUpJudge("DUCKDB"))
        assert.ok(
            skip < SKIP_BUDGET_MS,
            `expected a debounced no-op (<${SKIP_BUDGET_MS}ms), took ${skip.toFixed(0)}ms`
        )
    })

    it("warms each dialect independently", async () => {
        await warmUpJudge("DUCKDB")
        // POSTGRES has its own warm state, so this must actually run (not skip).
        const postgres = await timed(() => warmUpJudge("POSTGRES"))
        assert.ok(
            postgres >= SKIP_BUDGET_MS,
            `expected POSTGRES to warm independently, took only ${postgres.toFixed(0)}ms`
        )
        // ...and a follow-up POSTGRES warm is then debounced.
        const skip = await timed(() => warmUpJudge("POSTGRES"))
        assert.ok(
            skip < SKIP_BUDGET_MS,
            `expected POSTGRES re-warm to be debounced, took ${skip.toFixed(0)}ms`
        )
    })

    it("never throws even when warm-up cannot complete", async () => {
        const previous = process.env.CONTEST_JUDGE_WARM_TIMEOUT_MS
        // Force the warm run to be killed mid-flight; warm-up must swallow it.
        process.env.CONTEST_JUDGE_WARM_TIMEOUT_MS = "1"
        try {
            await assert.doesNotReject(() => warmUpJudge("DUCKDB"))
        } finally {
            if (previous === undefined) {
                delete process.env.CONTEST_JUDGE_WARM_TIMEOUT_MS
            } else {
                process.env.CONTEST_JUDGE_WARM_TIMEOUT_MS = previous
            }
        }
    })
})
