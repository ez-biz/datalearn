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
            const solutions =
                (p.solutions as Record<string, string>) ?? {}
            const expectedOutputs =
                (p.expectedOutputs as Record<string, string>) ?? {}

            for (const dialect of p.dialects) {
                totalChecks++
                const label = `#${p.number} ${p.slug} [${dialect}]`

                const solutionSql =
                    solutions[dialect] || p.solutionSql || ""
                const expectedRaw =
                    expectedOutputs[dialect] || p.expectedOutput || ""

                if (!solutionSql.trim()) {
                    failures.push({ label, reason: "no solution for this dialect" })
                    console.log(`SKIP ${label} :: no solution for this dialect`)
                    continue
                }
                if (!p.schema?.sql) {
                    failures.push({ label, reason: "no schema attached" })
                    console.log(`FAIL ${label} :: no schema attached`)
                    totalFailed++
                    continue
                }

                let expected: unknown
                try {
                    expected = JSON.parse(expectedRaw)
                } catch {
                    failures.push({
                        label,
                        reason: "expectedOutput is not valid JSON",
                    })
                    console.log(`FAIL ${label} :: expectedOutput not JSON`)
                    totalFailed++
                    continue
                }

                const stmts = p.schema.sql
                    .split(/;\s*\n|;\s*$/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)

                try {
                    const rows =
                        dialect === "DUCKDB"
                            ? await runDuckDB(stmts, solutionSql)
                            : await runPGlite(stmts, solutionSql)
                    const verdict = compareResults(rows, expected, {
                        ordered: p.ordered,
                    })
                    if (verdict.ok) {
                        console.log(`OK   ${label}`)
                    } else {
                        failures.push({ label, reason: verdict.reason })
                        console.log(`FAIL ${label} :: ${verdict.reason}`)
                        totalFailed++
                    }
                } catch (e: any) {
                    failures.push({
                        label,
                        reason: e?.message ?? String(e),
                    })
                    console.log(
                        `FAIL ${label} :: ${truncate(e?.message ?? String(e))}`
                    )
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
        return reader.getRowObjectsJson() as Record<string, unknown>[]
    } finally {
        conn.disconnectSync()
    }
}

async function runPGlite(stmts: string[], sql: string) {
    const db = new PGlite()
    await db.waitReady
    for (const s of stmts) await db.exec(s)
    const r = await db.query(sql)
    return r.rows as Record<string, unknown>[]
}

function truncate(s: string, n = 200) {
    return s.length > n ? s.slice(0, n) + "…" : s
}
