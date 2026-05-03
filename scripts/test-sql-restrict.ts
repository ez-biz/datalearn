// Quick assertions for lib/sql-restrict.ts. Run via:
//   npx tsx scripts/test-sql-restrict.ts
//
// Not in the e2e harness because the guard is pure-string and runs in
// the browser bundle — quickest verification path is a Node script.

import { checkReadOnlyQuery } from "../lib/sql-restrict"

const cases: Array<{ sql: string; expectOk: boolean; desc: string }> = [
    // ── allowed ─────────────────────────────────────────────────────
    {
        sql: "SELECT * FROM customers",
        expectOk: true,
        desc: "plain SELECT",
    },
    {
        sql: "  SELECT 1  ",
        expectOk: true,
        desc: "leading whitespace SELECT",
    },
    {
        sql: "-- this is my solution\nSELECT * FROM customers",
        expectOk: true,
        desc: "comment-prefixed SELECT",
    },
    {
        sql: "/* block comment */ SELECT * FROM customers",
        expectOk: true,
        desc: "block-comment-prefixed SELECT",
    },
    {
        sql: "WITH cte AS (SELECT id FROM orders) SELECT * FROM cte",
        expectOk: true,
        desc: "CTE SELECT",
    },
    {
        sql: "EXPLAIN SELECT * FROM customers",
        expectOk: true,
        desc: "EXPLAIN",
    },
    {
        sql: "EXPLAIN ANALYZE SELECT * FROM customers",
        expectOk: true,
        desc: "EXPLAIN ANALYZE",
    },
    {
        sql: 'DESCRIBE "customers"',
        expectOk: true,
        desc: "DESCRIBE (DuckDB schema introspection)",
    },
    {
        sql: "SELECT update_at, deleted_at FROM users",
        expectOk: true,
        desc: "false-positive avoidance — column names contain UPDATE/DELETE substrings",
    },
    {
        sql: "VALUES (1), (2), (3)",
        expectOk: true,
        desc: "VALUES literal",
    },
    {
        sql: "",
        expectOk: true,
        desc: "empty query (engine handles natural error)",
    },
    {
        sql: "   ",
        expectOk: true,
        desc: "whitespace-only (engine handles)",
    },
    {
        sql: "SELECT 1;",
        expectOk: true,
        desc: "single SELECT with trailing semicolon",
    },

    // ── blocked ─────────────────────────────────────────────────────
    { sql: "DROP TABLE customers", expectOk: false, desc: "DROP" },
    { sql: "CREATE TABLE x (id INT)", expectOk: false, desc: "CREATE" },
    {
        sql: "ALTER TABLE customers ADD COLUMN x INT",
        expectOk: false,
        desc: "ALTER",
    },
    { sql: "TRUNCATE customers", expectOk: false, desc: "TRUNCATE" },
    {
        sql: "INSERT INTO customers VALUES (99, 'X')",
        expectOk: false,
        desc: "INSERT",
    },
    { sql: "UPDATE customers SET name = 'X'", expectOk: false, desc: "UPDATE" },
    {
        sql: "DELETE FROM customers WHERE id = 1",
        expectOk: false,
        desc: "DELETE",
    },
    {
        sql: "GRANT SELECT ON customers TO public",
        expectOk: false,
        desc: "GRANT",
    },
    { sql: "BEGIN", expectOk: false, desc: "BEGIN transaction" },
    { sql: "COMMIT", expectOk: false, desc: "COMMIT" },
    {
        sql: "PRAGMA threads = 4",
        expectOk: false,
        desc: "PRAGMA (DuckDB engine config)",
    },
    {
        sql: "ATTACH 'foo.db'",
        expectOk: false,
        desc: "ATTACH (DuckDB external DB)",
    },
    {
        sql: "COPY customers FROM '/tmp/x.csv'",
        expectOk: false,
        desc: "COPY",
    },
    {
        sql: "SELECT 1; DROP TABLE customers",
        expectOk: false,
        desc: "multi-statement: SELECT + DROP",
    },
    {
        sql: "SELECT 1;\n\n  DROP TABLE customers;\n",
        expectOk: false,
        desc: "multi-statement with whitespace + trailing semicolon",
    },
    {
        sql: "WITH cte AS (DELETE FROM customers RETURNING *) SELECT * FROM cte",
        expectOk: false,
        desc: "CTE-wrapped DML (Postgres)",
    },
    {
        sql: "WITH cte AS (INSERT INTO customers VALUES (1) RETURNING id) SELECT * FROM cte",
        expectOk: false,
        desc: "CTE-wrapped INSERT",
    },
    {
        sql: "-- DROP TABLE customers\nDROP TABLE customers",
        expectOk: false,
        desc: "comment-then-actual DROP (the DROP after the comment is real)",
    },
]

let passed = 0
let failed = 0
for (const c of cases) {
    const result = checkReadOnlyQuery(c.sql)
    const ok = result.ok === c.expectOk
    if (ok) {
        passed++
        console.log(`  OK   ${c.desc}`)
    } else {
        failed++
        console.log(
            `  FAIL ${c.desc}\n       sql: ${JSON.stringify(c.sql)}\n       expected ok=${c.expectOk}, got ${JSON.stringify(result)}`
        )
    }
}

console.log(
    `\n${failed === 0 ? "✓" : "✗"} ${passed} / ${passed + failed} cases pass`
)
if (failed > 0) process.exit(1)
