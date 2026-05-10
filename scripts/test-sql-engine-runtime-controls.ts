import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
    QueryTimeoutError,
    isQueryTimeoutError,
    runWithTimeout,
} from "../lib/sql-engine/runtime-controls"

describe("SQL engine runtime controls", () => {
    it("returns the operation result when it finishes before the timeout", async () => {
        const result = await runWithTimeout({
            operation: () => Promise.resolve("ok"),
            timeoutMs: 50,
        })

        assert.equal(result, "ok")
    })

    it("throws a timeout error and waits for recovery when the operation hangs", async () => {
        let recovered = false

        await assert.rejects(
            runWithTimeout({
                operation: () => new Promise<never>(() => {}),
                timeoutMs: 5,
                onTimeout: async () => {
                    await Promise.resolve()
                    recovered = true
                },
            }),
            (error) => {
                assert.ok(error instanceof QueryTimeoutError)
                assert.equal(isQueryTimeoutError(error), true)
                assert.equal(
                    error.message,
                    "Query timed out - engine session was reset."
                )
                return true
            }
        )

        assert.equal(recovered, true)
    })

    it("does not convert normal operation failures into timeout errors", async () => {
        await assert.rejects(
            runWithTimeout({
                operation: async () => {
                    throw new Error("syntax error")
                },
                timeoutMs: 50,
            }),
            (error) => {
                assert.equal(isQueryTimeoutError(error), false)
                assert.equal((error as Error).message, "syntax error")
                return true
            }
        )
    })
})
