// Probe what happens when AVG() runs over a DOUBLE PRECISION column
// in DuckDB-Node vs PGlite. Reproduces the user's concern: cross-engine
// AVG-over-floats might serialize differently and trip the validator.

import { PGlite } from "@electric-sql/pglite"
import { DuckDBInstance } from "@duckdb/node-api"
import { compareResults } from "../lib/sql-validator"

const SCHEMA = `
CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY,
    customer_id INTEGER,
    order_date DATE,
    total_amount DOUBLE PRECISION
);
INSERT INTO orders VALUES (1001, 1, '2023-01-15', 1350.55);
INSERT INTO orders VALUES (1002, 2, '2023-01-16', 800.49);
INSERT INTO orders VALUES (1003, 1, '2023-02-10', 100);
INSERT INTO orders VALUES (1004, 3, '2023-02-20', 1350.99);
INSERT INTO orders VALUES (1005, 2, '2023-03-05', 0.10);
INSERT INTO orders VALUES (1006, 4, '2023-03-12', 0.20);
INSERT INTO orders VALUES (1007, 4, '2023-03-13', 0.30);
`

const QUERIES = [
    {
        name: "Plain AVG (single value)",
        sql: "SELECT AVG(total_amount) AS avg_amount FROM orders",
    },
    {
        name: "AVG aliased + ROUND",
        sql: "SELECT ROUND(AVG(total_amount)::numeric, 2) AS avg_amount FROM orders",
    },
    {
        name: "AVG grouped by customer",
        sql: "SELECT customer_id, AVG(total_amount) AS avg_amount FROM orders GROUP BY customer_id ORDER BY customer_id",
    },
    {
        name: "AVG with non-integer result",
        sql: "SELECT AVG(total_amount) / 3 AS divided_avg FROM orders",
    },
]

main().catch((e) => {
    console.error("test failed:", e)
    process.exit(1)
})

async function main() {
    const stmts = SCHEMA.split(/;\s*\n|;\s*$/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

    for (const q of QUERIES) {
        console.log(`\n──── ${q.name} ────`)
        console.log(`SQL: ${q.sql}`)

        let duckRows: Record<string, unknown>[] = []
        let pgRows: Record<string, unknown>[] = []
        let duckErr: string | null = null
        let pgErr: string | null = null

        try {
            const instance = await DuckDBInstance.create(":memory:")
            const conn = await instance.connect()
            for (const s of stmts) await conn.run(s)
            const reader = await conn.runAndReadAll(q.sql)
            duckRows = reader.getRowObjectsJson() as Record<string, unknown>[]
            conn.disconnectSync()
        } catch (e: any) {
            duckErr = e?.message ?? String(e)
        }

        try {
            const db = new PGlite()
            await db.waitReady
            for (const s of stmts) await db.exec(s)
            const r = await db.query(q.sql)
            pgRows = r.rows as Record<string, unknown>[]
        } catch (e: any) {
            pgErr = e?.message ?? String(e)
        }

        if (duckErr) {
            console.log(`DuckDB:   ERROR — ${truncate(duckErr)}`)
        } else {
            console.log(
                `DuckDB:   ${JSON.stringify(duckRows[0])}  (typeof first value: ${typeof Object.values(duckRows[0])[0]})`
            )
        }
        if (pgErr) {
            console.log(`Postgres: ERROR — ${truncate(pgErr)}`)
        } else {
            console.log(
                `Postgres: ${JSON.stringify(pgRows[0])}  (typeof first value: ${typeof Object.values(pgRows[0])[0]})`
            )
        }

        if (!duckErr && !pgErr) {
            const verdict = compareResults(duckRows, pgRows, { ordered: true })
            console.log(
                `Cross-engine equivalence: ${verdict.ok ? "✓ rows match via validator" : "✗ " + verdict.reason}`
            )
            if (!verdict.ok && "diff" in verdict && verdict.diff?.firstMismatch) {
                console.log(
                    `  user (DuckDB):   ${JSON.stringify(verdict.diff.firstMismatch.user)}`
                )
                console.log(
                    `  expected (PG):   ${JSON.stringify(verdict.diff.firstMismatch.expected)}`
                )
            }
        }
    }
}

function truncate(s: string, n = 200) {
    return s.length > n ? s.slice(0, n) + "…" : s
}
