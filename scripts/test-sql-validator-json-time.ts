import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { compareResults } from "../lib/sql-validator"

describe("SQL validator JSON and timestamp robustness", () => {
    it("deep-compares JSON objects without depending on key insertion order", () => {
        const result = compareResults(
            [
                {
                    payload: {
                        b: 2,
                        a: 1,
                        nested: { z: true, y: ["pg", "duck"] },
                    },
                },
            ],
            [
                {
                    payload: {
                        nested: { y: ["pg", "duck"], z: true },
                        a: 1,
                        b: 2,
                    },
                },
            ],
            { ordered: true }
        )

        assert.deepEqual(result, { ok: true })
    })

    it("fails when nested JSON values differ", () => {
        const result = compareResults(
            [{ payload: { a: 1, nested: { ok: true } } }],
            [{ payload: { a: 1, nested: { ok: false } } }],
            { ordered: true }
        )

        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.equal(result.reason, "Row 1 differs from expected.")
        }
    })

    it("compares JSON objects in unordered row canonicalization", () => {
        const result = compareResults(
            [
                { id: 2, payload: { role: "admin", active: true } },
                { id: 1, payload: { active: false, role: "learner" } },
            ],
            [
                { id: 1, payload: { role: "learner", active: false } },
                { id: 2, payload: { active: true, role: "admin" } },
            ],
            { ordered: false }
        )

        assert.deepEqual(result, { ok: true })
    })

    it("normalizes equivalent timezone timestamp strings to the same instant", () => {
        const result = compareResults(
            [{ created_at: "2026-05-05 10:00:00+05:30" }],
            [{ created_at: "2026-05-05T04:30:00.000Z" }],
            { ordered: true }
        )

        assert.deepEqual(result, { ok: true })
    })

    it("treats null and undefined inside JSON as equivalent", () => {
        const result = compareResults(
            [{ payload: { a: null, b: 1 } }],
            [{ payload: { a: undefined, b: 1 } }],
            { ordered: true }
        )

        assert.deepEqual(result, { ok: true })
    })

    it("fails when JSON array elements are reordered", () => {
        const result = compareResults(
            [{ tags: [1, 2, 3] }],
            [{ tags: [3, 2, 1] }],
            { ordered: true }
        )

        assert.equal(result.ok, false)
    })

    it("fails when a JSON value's type changes", () => {
        const result = compareResults(
            [{ payload: { a: 1 } }],
            [{ payload: { a: "1" } }],
            { ordered: true }
        )

        assert.equal(result.ok, false)
    })

    it("normalizes BigInt values inside JSON cells", () => {
        const result = compareResults(
            [{ payload: { count: BigInt(42) } }],
            [{ payload: { count: 42 } }],
            { ordered: true }
        )

        assert.deepEqual(result, { ok: true })
    })

    it("stringifies out-of-safe-range BigInts inside JSON cells", () => {
        const huge = BigInt(Number.MAX_SAFE_INTEGER) + BigInt(10)
        const result = compareResults(
            [{ payload: { id: huge } }],
            [{ payload: { id: huge.toString() } }],
            { ordered: true }
        )

        assert.deepEqual(result, { ok: true })
    })

    it("normalizes Date instances inside JSON cells", () => {
        const result = compareResults(
            [{ payload: { ts: new Date("2026-05-05T04:30:00.000Z") } }],
            [{ payload: { ts: "2026-05-05T04:30:00.000Z" } }],
            { ordered: true }
        )

        assert.deepEqual(result, { ok: true })
    })
})
