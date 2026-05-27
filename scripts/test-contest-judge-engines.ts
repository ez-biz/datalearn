import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { runDuckDBQuery, runPGliteQuery } from "../lib/contest-judge-engines"

const SCHEMA_SQL =
    "CREATE TABLE t (x INT, y TEXT); " +
    "INSERT INTO t VALUES (1, 'a'), (2, 'b'), (3, 'c');"

describe("runDuckDBQuery", () => {
    it("runs a simple SELECT and returns rows", async () => {
        const result = await runDuckDBQuery({
            schemaSql: SCHEMA_SQL,
            userSql: "SELECT * FROM t ORDER BY x",
            timeoutMs: 5_000,
        })

        assert.equal(result.kind, "ok")
        if (result.kind === "ok") {
            assert.deepEqual(result.rows.map((row) => row.x), [1, 2, 3])
        }
    })

    it("blocks external file access", async () => {
        const result = await runDuckDBQuery({
            schemaSql: SCHEMA_SQL,
            userSql: "SELECT * FROM read_csv_auto('/etc/passwd')",
            timeoutMs: 5_000,
        })

        assert.equal(result.kind, "error")
    })

    it("returns timeout when the user-query budget is already exhausted", async () => {
        const result = await runDuckDBQuery({
            schemaSql: SCHEMA_SQL,
            userSql: "SELECT * FROM t ORDER BY x",
            timeoutMs: 0,
        })

        assert.equal(result.kind, "timeout")
    })
})

describe("runPGliteQuery", () => {
    it("runs a simple SELECT and returns rows", async () => {
        const result = await runPGliteQuery({
            schemaSql: SCHEMA_SQL,
            userSql: "SELECT * FROM t ORDER BY x",
            timeoutMs: 5_000,
        })

        assert.equal(result.kind, "ok")
        if (result.kind === "ok") {
            assert.deepEqual(result.rows.map((row) => row.x), [1, 2, 3])
        }
    })

    it("returns an error for blocked server file functions", async () => {
        const result = await runPGliteQuery({
            schemaSql: SCHEMA_SQL,
            userSql: "SELECT pg_read_file('/etc/passwd')",
            timeoutMs: 5_000,
        })

        assert.equal(result.kind, "error")
    })
})
