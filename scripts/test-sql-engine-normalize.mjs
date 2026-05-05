import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    normalizeSqlCell,
    normalizeSqlRow,
    normalizeSqlRows,
} from "../lib/sql-engine/normalize.ts"

describe("SQL engine row normalization", () => {
    it("turns nullish values into null", () => {
        assert.equal(normalizeSqlCell(null), null)
        assert.equal(normalizeSqlCell(undefined), null)
    })

    it("serializes Date values as ISO strings", () => {
        assert.equal(
            normalizeSqlCell(new Date("2026-01-02T03:04:05.000Z")),
            "2026-01-02T03:04:05.000Z"
        )
    })

    it("keeps safe bigints numeric and unsafe bigints stringified", () => {
        assert.equal(normalizeSqlCell(42n), 42)
        assert.equal(
            normalizeSqlCell(BigInt(Number.MAX_SAFE_INTEGER) + 2n),
            "9007199254740993"
        )
    })

    it("normalizes object wrappers through toJSON", () => {
        assert.equal(
            normalizeSqlCell({
                toJSON() {
                    return 7n
                },
            }),
            7
        )
    })

    it("normalizes every row cell without mutating the input", () => {
        const original = {
            id: 1n,
            created_at: new Date("2026-05-05T10:00:00.000Z"),
            missing: undefined,
        }
        const normalized = normalizeSqlRow(original)
        assert.deepEqual(normalized, {
            id: 1,
            created_at: "2026-05-05T10:00:00.000Z",
            missing: null,
        })
        assert.equal(typeof original.id, "bigint")
    })

    it("normalizes arrays of rows", () => {
        assert.deepEqual(normalizeSqlRows([{ id: 1n }, { id: 2n }]), [
            { id: 1 },
            { id: 2 },
        ])
    })
})
