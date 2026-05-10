#!/usr/bin/env node
// Per-dialect audit. For each PUBLISHED problem, runs that dialect's
// solution against the matching engine, compares to that dialect's
// expectedOutput. Replaces the older audit-postgres-compatibility
// (which was Postgres-only).
//
// Reads the v0.5.0+ per-dialect map (`solutions`, `expectedOutputs`)
// with fallback to the legacy single fields when an entry is missing
// — so this works during the v0.5.0 transition window.
//
// Usage:
//   DATABASE_URL='<url>' npx tsx scripts/audit-all-dialects.ts

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { PGlite } from "@electric-sql/pglite"
import { DuckDBInstance } from "@duckdb/node-api"
import { compareResults } from "../lib/sql-validator"
import { resolveDialectAuditPair } from "../lib/sql-engine/dialect-audit"
import { normalizeSqlRows } from "../lib/sql-engine/normalize"
import { splitSqlStatements } from "../lib/sql-engine/statements"

main().catch((e) => {
    console.error("Audit failed:", e)
    process.exit(1)
})

async function main() {
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not set.")
        process.exit(1)
    }

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    let totalChecks = 0
    let totalFailed = 0
    const failures: Array<{ label: string; reason: string }> = []

    try {
        const problems = await prisma.sQLProblem.findMany({
            where: { status: "PUBLISHED" },
            select: {
                number: true,
                slug: true,
                ordered: true,
                dialects: true,
                solutionSql: true,
                expectedOutput: true,
                solutions: true,
                expectedOutputs: true,
                schema: { select: { name: true, sql: true } },
            },
            orderBy: { number: "asc" },
        })

        console.log(`Auditing ${problems.length} PUBLISHED problems across all listed dialects…\n`)

        for (const p of problems) {
            for (const dialect of p.dialects) {
                totalChecks++
                const pair = resolveDialectAuditPair(p, dialect)
                if (!pair.ok) {
                    failures.push({ label: pair.label, reason: pair.reason })
                    console.log(`FAIL ${pair.label} :: ${pair.reason}`)
                    totalFailed++
                    continue
                }

                const stmts = splitSqlStatements(pair.schemaSql)

                try {
                    const rows =
                        dialect === "DUCKDB"
                            ? await runDuckDB(stmts, pair.solutionSql)
                            : await runPGlite(stmts, pair.solutionSql)
                    const verdict = compareResults(rows, pair.expectedRows, {
                        ordered: pair.ordered,
                    })
                    if (verdict.ok) {
                        console.log(`OK   ${pair.label}`)
                    } else {
                        failures.push({ label: pair.label, reason: verdict.reason })
                        console.log(`FAIL ${pair.label} :: ${verdict.reason}`)
                        totalFailed++
                    }
                } catch (e: unknown) {
                    const message =
                        e instanceof Error ? e.message : String(e)
                    failures.push({
                        label: pair.label,
                        reason: message,
                    })
                    console.log(`FAIL ${pair.label} :: ${truncate(message)}`)
                    totalFailed++
                }
            }
        }

        console.log(
            `\n${totalFailed === 0 ? "✓" : "✗"} ${
                totalChecks - totalFailed
            } / ${totalChecks} (problem × dialect) pairs pass.`
        )
        if (totalFailed > 0) {
            console.log(`\nFailing pairs:`)
            for (const f of failures) {
                console.log(`  - ${f.label} :: ${truncate(f.reason)}`)
            }
            process.exit(1)
        }
    } finally {
        await prisma.$disconnect()
        await pool.end().catch(() => {})
    }
}

async function runDuckDB(stmts: string[], sql: string) {
    const inst = await DuckDBInstance.create(":memory:")
    const conn = await inst.connect()
    try {
        for (const s of stmts) await conn.run(s)
        const reader = await conn.runAndReadAll(sql)
        return normalizeSqlRows(
            reader.getRowObjectsJson() as Record<string, unknown>[]
        )
    } finally {
        conn.disconnectSync()
        inst.closeSync()
    }
}

async function runPGlite(stmts: string[], sql: string) {
    const db = new PGlite()
    try {
        await db.waitReady
        for (const s of stmts) await db.exec(s)
        const r = await db.query(sql)
        return normalizeSqlRows(r.rows as Record<string, unknown>[])
    } finally {
        await db.close()
    }
}

function truncate(s: string, n = 200) {
    return s.length > n ? s.slice(0, n) + "…" : s
}
