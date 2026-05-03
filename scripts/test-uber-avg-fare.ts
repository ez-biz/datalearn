// Reproduce production problem #18 (uber-average-fare) result drift.
// User reported: production returns `[{"avg_fare":"\"39889\""}]`
// expected: `[{"avg_fare":398.89}]`.
//
// This script fetches the problem from prod, runs solutionSql in
// BOTH DuckDB-Node and PGlite-Node, and prints raw results so we
// can see exactly where the type/serialization is going wrong.

import "dotenv/config"
import fs from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import { DuckDBInstance } from "@duckdb/node-api"

const API_KEY = process.env.DATALEARN_API_KEY
const BASE = process.env.DATALEARN_BASE_URL || "https://www.learndatanow.com"

main().catch((e) => {
    console.error("test failed:", e)
    process.exit(1)
})

async function main() {
    if (!API_KEY) {
        console.error("DATALEARN_API_KEY required (passed via env)")
        process.exit(1)
    }
    const r = await fetch(`${BASE}/api/admin/problems/uber-average-fare`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
    })
    const json = (await r.json()) as { data?: any }
    const p = json.data
    if (!p) {
        console.error("Problem not found")
        process.exit(1)
    }

    const schemaSql: string = p.schema?.sql ?? ""
    const solutionSql: string = p.solutionSql
    const expected: unknown = JSON.parse(p.expectedOutput)

    console.log("solution:", solutionSql)
    console.log("expected:", JSON.stringify(expected))
    console.log()

    const stmts = schemaSql
        .split(/;\s*\n|;\s*$/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

    // ─── DuckDB ────────────────────────────────────────────
    const dbInst = await DuckDBInstance.create(":memory:")
    const conn = await dbInst.connect()
    try {
        for (const s of stmts) await conn.run(s)
        const reader = await conn.runAndReadAll(solutionSql)
        const rows = reader.getRowObjectsJson()
        console.log("DuckDB raw rows :", JSON.stringify(rows))
        console.log(
            "DuckDB types    :",
            rows.length
                ? JSON.stringify(
                      Object.fromEntries(
                          Object.entries(rows[0]).map(([k, v]) => [
                              k,
                              `${typeof v}${v instanceof Date ? " (Date)" : ""}`,
                          ])
                      )
                  )
                : "(no rows)"
        )
    } finally {
        conn.disconnectSync()
    }

    console.log()

    // ─── PGlite ────────────────────────────────────────────
    const pg = new PGlite()
    await pg.waitReady
    for (const s of stmts) await pg.exec(s)
    const result = await pg.query(solutionSql)
    console.log("PGlite raw rows :", JSON.stringify(result.rows))
    console.log(
        "PGlite types    :",
        result.rows.length
            ? JSON.stringify(
                  Object.fromEntries(
                      Object.entries(result.rows[0] as Record<string, unknown>).map(
                          ([k, v]) => [
                              k,
                              `${typeof v}${v instanceof Date ? " (Date)" : ""}`,
                          ]
                      )
                  )
              )
            : "(no rows)"
    )
    console.log("PGlite fields   :", JSON.stringify(result.fields))
}
