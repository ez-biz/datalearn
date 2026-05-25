import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { validateContestSql } from "../lib/contest-judge-validator"

describe("validateContestSql happy paths", () => {
    it("accepts a plain SELECT in DuckDB", async () => {
        const result = await validateContestSql("SELECT 1", "DUCKDB")
        assert.equal(result.ok, true)
    })

    it("accepts a SELECT with a CTE in DuckDB", async () => {
        const result = await validateContestSql(
            "WITH t AS (SELECT 1 AS x) SELECT * FROM t",
            "DUCKDB"
        )
        assert.equal(result.ok, true)
    })

    it("accepts safe aggregates in DuckDB", async () => {
        const result = await validateContestSql(
            "SELECT count(*), sum(x), avg(x) FROM t",
            "DUCKDB"
        )
        assert.equal(result.ok, true)
    })

    it("accepts a plain SELECT in Postgres", async () => {
        const result = await validateContestSql("SELECT 1", "POSTGRES")
        assert.equal(result.ok, true)
    })

    it("accepts a SELECT with a CTE in Postgres", async () => {
        const result = await validateContestSql(
            "WITH t AS (SELECT 1 AS x) SELECT * FROM t",
            "POSTGRES"
        )
        assert.equal(result.ok, true)
    })
})

describe("validateContestSql top-level statement rejections", () => {
    for (const [dialect, sql] of [
        ["DUCKDB", "INSERT INTO t VALUES (1)"],
        ["DUCKDB", "UPDATE t SET x = 1"],
        ["DUCKDB", "DELETE FROM t"],
        ["DUCKDB", "CREATE TABLE x (y INT)"],
        ["DUCKDB", "DROP TABLE t"],
        ["DUCKDB", "ATTACH 'foo.duckdb'"],
        ["DUCKDB", "INSTALL httpfs"],
        ["DUCKDB", "LOAD httpfs"],
        ["DUCKDB", "PRAGMA disable_verification"],
        ["DUCKDB", "SET memory_limit = '1GB'"],
        ["DUCKDB", "COPY t FROM '/etc/passwd'"],
        ["DUCKDB", "BEGIN"],
        ["DUCKDB", "COMMIT"],
        ["POSTGRES", "INSERT INTO t VALUES (1)"],
        ["POSTGRES", "UPDATE t SET x = 1"],
        ["POSTGRES", "DELETE FROM t"],
        ["POSTGRES", "DROP TABLE t"],
        ["POSTGRES", "TRUNCATE t"],
        ["POSTGRES", "COPY t FROM PROGRAM 'cat /etc/passwd'"],
        ["POSTGRES", "GRANT ALL ON t TO public"],
    ] as const) {
        it(`rejects ${dialect}: ${sql.slice(0, 50)}`, async () => {
            const result = await validateContestSql(sql, dialect)
            assert.equal(result.ok, false)
            if (!result.ok) {
                assert.equal(result.reasonCode, "UNSUPPORTED_STATEMENT")
            }
        })
    }
})

describe("validateContestSql rejects DML inside CTEs", () => {
    for (const sql of [
        "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d",
        "WITH u AS (UPDATE t SET x = 1 RETURNING *) SELECT * FROM u",
        "WITH i AS (INSERT INTO t VALUES (1) RETURNING *) SELECT * FROM i",
    ]) {
        it(`Postgres rejects: ${sql.slice(0, 60)}`, async () => {
            const result = await validateContestSql(sql, "POSTGRES")
            assert.equal(result.ok, false, `expected rejection for ${sql}`)
            if (!result.ok) {
                assert.equal(result.reasonCode, "UNSUPPORTED_STATEMENT")
            }
        })
    }
})

describe("validateContestSql denylisted function rejections", () => {
    for (const [dialect, sql] of [
        ["DUCKDB", "SELECT * FROM read_csv_auto('/etc/passwd')"],
        ["DUCKDB", "SELECT * FROM read_parquet('s3://bucket/x.parquet')"],
        ["DUCKDB", "SELECT httpfs_get('http://169.254.169.254/')"],
        ["DUCKDB", "WITH t AS (SELECT read_csv('x') AS r) SELECT * FROM t"],
        ["DUCKDB", "SELECT load_extension('foo')"],
        ["DUCKDB", "SELECT * FROM glob('/var/*')"],
        ["DUCKDB", "SELECT (SELECT read_csv_auto('x')) AS x"],
        ["POSTGRES", "SELECT pg_read_file('/etc/passwd')"],
        ["POSTGRES", "SELECT lo_import('/etc/shadow')"],
        ["POSTGRES", "SELECT dblink_exec('host=evil', 'SELECT 1')"],
        ["POSTGRES", "SELECT (SELECT pg_read_file('x'))"],
    ] as const) {
        it(`rejects ${dialect}: ${sql.slice(0, 60)}`, async () => {
            const result = await validateContestSql(sql, dialect)
            assert.equal(result.ok, false)
            if (!result.ok) {
                assert.equal(result.reasonCode, "FORBIDDEN_FUNCTION")
            }
        })
    }
})

describe("validateContestSql schema-qualified forbidden functions", () => {
    it("rejects pg_catalog.pg_read_file in Postgres", async () => {
        const result = await validateContestSql(
            "SELECT pg_catalog.pg_read_file('/etc/passwd')",
            "POSTGRES"
        )
        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.equal(result.reasonCode, "FORBIDDEN_FUNCTION")
        }
    })
})

describe("validateContestSql multiple statements", () => {
    it("rejects SELECT followed by DuckDB extension install", async () => {
        const result = await validateContestSql("SELECT 1; INSTALL httpfs", "DUCKDB")
        assert.equal(result.ok, false)
    })

    it("rejects SELECT followed by Postgres DDL", async () => {
        const result = await validateContestSql("SELECT 1; DROP TABLE t", "POSTGRES")
        assert.equal(result.ok, false)
    })
})

describe("validateContestSql size cap", () => {
    it("rejects SQL over 64 KiB before parsing", async () => {
        const sql = `SELECT ${"1,".repeat(40_000)}1`
        const result = await validateContestSql(sql, "DUCKDB")
        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.equal(result.reasonCode, "SIZE_LIMIT")
        }
    })
})

describe("validateContestSql parse errors", () => {
    it("rejects DuckDB garbage with PARSE_ERROR", async () => {
        const result = await validateContestSql("not even sql here ((", "DUCKDB")
        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.equal(result.reasonCode, "PARSE_ERROR")
        }
    })
})
