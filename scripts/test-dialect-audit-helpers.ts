import assert from "node:assert/strict"

import {
    DialectAuditProblem,
    resolveDialectAuditPair,
} from "../lib/sql-engine/dialect-audit"

const baseProblem: DialectAuditProblem = {
    number: 42,
    slug: "example-problem",
    ordered: false,
    dialects: ["DUCKDB", "POSTGRES"],
    solutionSql: null,
    expectedOutput: null,
    solutions: {},
    expectedOutputs: {},
    schema: { sql: "CREATE TABLE users (id INTEGER);" },
}

assert.deepEqual(resolveDialectAuditPair(baseProblem, "DUCKDB"), {
    ok: false,
    label: "#42 example-problem [DUCKDB]",
    reason: "no solution for this dialect",
})

assert.deepEqual(
    resolveDialectAuditPair(
        {
            ...baseProblem,
            solutionSql: "SELECT 1 AS id;",
            expectedOutput: "",
        },
        "DUCKDB"
    ),
    {
        ok: false,
        label: "#42 example-problem [DUCKDB]",
        reason: "no expected output for this dialect",
    }
)

assert.deepEqual(
    resolveDialectAuditPair(
        {
            ...baseProblem,
            solutionSql: "SELECT 1 AS id;",
            expectedOutput: "not-json",
        },
        "DUCKDB"
    ),
    {
        ok: false,
        label: "#42 example-problem [DUCKDB]",
        reason: "expectedOutput is not valid JSON",
    }
)

assert.deepEqual(
    resolveDialectAuditPair(
        {
            ...baseProblem,
            solutionSql: "SELECT 1 AS id;",
            expectedOutput: '[{"id":1}]',
            solutions: {
                POSTGRES: "SELECT 2 AS id;",
            },
            expectedOutputs: {
                POSTGRES: '[{"id":2}]',
            },
        },
        "POSTGRES"
    ),
    {
        ok: true,
        label: "#42 example-problem [POSTGRES]",
        ordered: false,
        schemaSql: "CREATE TABLE users (id INTEGER);",
        solutionSql: "SELECT 2 AS id;",
        expectedRows: [{ id: 2 }],
    }
)

assert.deepEqual(
    resolveDialectAuditPair(
        {
            ...baseProblem,
            solutionSql: "SELECT 1 AS id;",
            expectedOutput: '[{"id":1}]',
        },
        "DUCKDB"
    ),
    {
        ok: true,
        label: "#42 example-problem [DUCKDB]",
        ordered: false,
        schemaSql: "CREATE TABLE users (id INTEGER);",
        solutionSql: "SELECT 1 AS id;",
        expectedRows: [{ id: 1 }],
    }
)

console.log("dialect audit helper tests passed")
