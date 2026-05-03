#!/usr/bin/env node
// Validate a single problem's canonical solution against BOTH engines
// (DuckDB-Node and PGlite-Node), comparing each engine's output to
// the stored expectedOutput using the live compareResults validator.
//
// Usage:
//   DATABASE_URL='<url>' npx tsx scripts/validate-problem.ts <slug>
//
// Output: side-by-side per-engine result + verdict.

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { PGlite } from "@electric-sql/pglite"
import { DuckDBInstance } from "@duckdb/node-api"
import { compareResults } from "../lib/sql-validator"

main().catch((e) => {
    console.error("Validation failed:", e)
    process.exit(1)
})

async function main() {
    const slug = process.argv[2]
    if (!slug) {
        console.error("Usage: npx tsx scripts/validate-problem.ts <slug>")
        process.exit(1)
    }
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is not set.")
        process.exit(1)
    }

    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        const p = await prisma.sQLProblem.findUnique({
            where: { slug },
            select: {
                number: true,
                slug: true,
                title: true,
                ordered: true,
                solutionSql: true,
                expectedOutput: true,
                dialects: true,
                schema: { select: { name: true, sql: true } },
            },
        })
        if (!p) {
            console.error(`No problem with slug "${slug}".`)
            process.exit(1)
        }
        if (!p.solutionSql) {
            console.error(`Problem "${slug}" has no solutionSql to validate.`)
            process.exit(1)
        }
        if (!p.schema?.sql) {
            console.error(`Problem "${slug}" has no schema attached.`)
            process.exit(1)
        }

        const expected = JSON.parse(p.expectedOutput)
        const stmts = p.schema.sql
            .split(/;\s*\n|;\s*$/)
            .map((s) => s.trim())
            .filter((s) => s.length > 0)

        console.log(`\n#${p.number} ${p.title} (${p.slug})`)
        console.log(`schema: ${p.schema.name}`)
        console.log(`dialects: [${p.dialects.join(", ")}]`)
        console.log(`ordered: ${p.ordered}`)
        console.log(`expected rows: ${expected.length}`)
        console.log(`---`)

        // ─── DuckDB ──────────────────────────────────────────────────
        const duckRows = await runDuckDB(stmts, p.solutionSql)
        const duckVerdict = compareResults(duckRows, expected, {
            ordered: p.ordered,
        })
        console.log(`DuckDB:`)
        console.log(`  rows returned: ${duckRows.length}`)
        console.log(`  first row: ${JSON.stringify(duckRows[0])}`)
        console.log(
            `  verdict: ${duckVerdict.ok ? "✓ matches expectedOutput" : "✗ " + duckVerdict.reason}`
        )

        // ─── PGlite ──────────────────────────────────────────────────
        const pgRows = await runPGlite(stmts, p.solutionSql)
        const pgVerdict = compareResults(pgRows, expected, {
            ordered: p.ordered,
        })
        console.log(`Postgres:`)
        console.log(`  rows returned: ${pgRows.length}`)
        console.log(`  first row: ${JSON.stringify(pgRows[0])}`)
        console.log(
            `  verdict: ${pgVerdict.ok ? "✓ matches expectedOutput" : "✗ " + pgVerdict.reason}`
        )

        // ─── Cross-engine equivalence ────────────────────────────────
        const crossVerdict = compareResults(duckRows, pgRows, {
            ordered: p.ordered,
        })
        console.log(`\nDuckDB vs Postgres (same query, both engines):`)
        console.log(
            `  ${crossVerdict.ok ? "✓ both engines produce equivalent rows" : "✗ engines disagree: " + crossVerdict.reason}`
        )

        // ─── Expected first row ──────────────────────────────────────
        console.log(`\nExpected first row:`)
        console.log(`  ${JSON.stringify(expected[0])}`)

        const allPass = duckVerdict.ok && pgVerdict.ok && crossVerdict.ok
        console.log(`\n${allPass ? "✓" : "✗"} ${allPass ? "All checks pass" : "At least one check failed"}`)
        if (!allPass) process.exit(1)
    } finally {
        await prisma.$disconnect()
        await pool.end().catch(() => {})
    }
}

async function runDuckDB(
    stmts: string[],
    solutionSql: string
): Promise<Record<string, unknown>[]> {
    const instance = await DuckDBInstance.create(":memory:")
    const conn = await instance.connect()
    try {
        for (const s of stmts) {
            await conn.run(s)
        }
        const reader = await conn.runAndReadAll(solutionSql)
        const rows = reader.getRowObjectsJson()
        return rows as Record<string, unknown>[]
    } finally {
        conn.disconnectSync()
    }
}

async function runPGlite(
    stmts: string[],
    solutionSql: string
): Promise<Record<string, unknown>[]> {
    const db = new PGlite()
    await db.waitReady
    for (const s of stmts) {
        await db.exec(s)
    }
    const result = await db.query(solutionSql)
    return result.rows as Record<string, unknown>[]
}
