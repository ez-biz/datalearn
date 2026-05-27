import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { submitToJudge, type JudgeVerdict } from "../lib/contest-judge"

const SCHEMA = "CREATE TABLE t (x INT); INSERT INTO t VALUES (1);"
const EXPECTED = [{ x: 1 }]

type Case = {
    name: string
    dialect: "DUCKDB" | "POSTGRES"
    sql: string
    allowed: ReadonlyArray<JudgeVerdict>
}

const CASES: Case[] = [
    {
        name: "DuckDB read_csv_auto on /etc/passwd",
        dialect: "DUCKDB",
        sql: "SELECT * FROM read_csv_auto('/etc/passwd')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "DuckDB read_parquet on s3",
        dialect: "DUCKDB",
        sql: "SELECT * FROM read_parquet('s3://b/x.parquet')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "DuckDB httpfs_get",
        dialect: "DUCKDB",
        sql: "SELECT httpfs_get('http://169.254.169.254/')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "DuckDB INSTALL httpfs",
        dialect: "DUCKDB",
        sql: "INSTALL httpfs",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB LOAD httpfs",
        dialect: "DUCKDB",
        sql: "LOAD httpfs",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB ATTACH file",
        dialect: "DUCKDB",
        sql: "ATTACH 'foo.duckdb'",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB PRAGMA disable_verification",
        dialect: "DUCKDB",
        sql: "PRAGMA disable_verification",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB SET memory_limit override",
        dialect: "DUCKDB",
        sql: "SET memory_limit = '4GB'",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB COPY from host path",
        dialect: "DUCKDB",
        sql: "COPY t FROM '/etc/passwd'",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB CTE-wrapped read_csv",
        dialect: "DUCKDB",
        sql: "WITH x AS (SELECT * FROM read_csv('x')) SELECT * FROM x",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "DuckDB long range",
        dialect: "DUCKDB",
        sql: "SELECT count(*) FROM range(100000000000)",
        allowed: ["TIME_LIMIT", "MEMORY_LIMIT", "RUNTIME_ERROR"],
    },
    {
        name: "DuckDB large repeat",
        dialect: "DUCKDB",
        sql: "SELECT length(repeat('x', 500000000))",
        allowed: ["TIME_LIMIT", "MEMORY_LIMIT", "RUNTIME_ERROR"],
    },
    {
        name: "DuckDB stacked statement",
        dialect: "DUCKDB",
        sql: "SELECT 1; INSTALL httpfs",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB INSERT write",
        dialect: "DUCKDB",
        sql: "INSERT INTO t VALUES (99)",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB DROP TABLE",
        dialect: "DUCKDB",
        sql: "DROP TABLE t",
        allowed: ["REJECTED"],
    },
    {
        name: "DuckDB size cap",
        dialect: "DUCKDB",
        sql: `SELECT ${"1,".repeat(40_000)}1`,
        allowed: ["REJECTED"],
    },
    {
        name: "Postgres pg_read_file",
        dialect: "POSTGRES",
        sql: "SELECT pg_read_file('/etc/passwd')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "Postgres schema-qualified pg_read_file",
        dialect: "POSTGRES",
        sql: "SELECT pg_catalog.pg_read_file('/etc/passwd')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "Postgres lo_import",
        dialect: "POSTGRES",
        sql: "SELECT lo_import('/etc/shadow')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "Postgres dblink_exec",
        dialect: "POSTGRES",
        sql: "SELECT dblink_exec('host=evil','SELECT 1')",
        allowed: ["REJECTED", "COMPILE_ERROR", "RUNTIME_ERROR"],
    },
    {
        name: "Postgres INSERT write",
        dialect: "POSTGRES",
        sql: "INSERT INTO t VALUES (99)",
        allowed: ["REJECTED"],
    },
    {
        name: "Postgres mutating CTE delete",
        dialect: "POSTGRES",
        sql: "WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d",
        allowed: ["REJECTED"],
    },
    {
        name: "Postgres COPY FROM PROGRAM",
        dialect: "POSTGRES",
        sql: "COPY t FROM PROGRAM 'cat /etc/passwd'",
        allowed: ["REJECTED"],
    },
    {
        name: "Postgres stacked statement",
        dialect: "POSTGRES",
        sql: "SELECT 1; DROP TABLE t",
        allowed: ["REJECTED"],
    },
]

describe("contest judge escape regression corpus", () => {
    for (const testCase of CASES) {
        it(testCase.name, async () => {
            const outcome = await submitToJudge({
                dialect: testCase.dialect,
                userSql: testCase.sql,
                hiddenSchemaSql: SCHEMA,
                hiddenExpected: EXPECTED,
                ordered: false,
                timeoutMs: 1_000,
            })

            assert.ok(
                testCase.allowed.includes(outcome.verdict),
                `${testCase.name}: got verdict=${outcome.verdict} (${outcome.message ?? "no message"}), expected one of ${testCase.allowed.join(", ")}`
            )
            assert.notEqual(outcome.verdict, "ACCEPTED")
        })
    }
})
