#!/usr/bin/env node
// Audit each PUBLISHED problem whose `dialects` includes POSTGRES.
// For each: spin up a fresh PGlite (Postgres-WASM running in Node),
// replay the schema, run the canonical solution, and compare to
// `expectedOutput` using lib/sql-validator's compareResults — the
// same comparator the production validator uses.
//
// Usage:
//   DATABASE_URL='<url>' npx tsx scripts/audit-postgres-compatibility.ts
//
// Output: one line per problem. Either `OK <slug>` or
// `FAIL <slug> :: <reason>` with a one-line reason. Exits 1 if any
// failed so this can be wired into CI later.

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { PGlite } from "@electric-sql/pglite"
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

    let totalAudited = 0
    let totalFailed = 0
    const failures: Array<{ label: string; reason: string }> = []

    try {
        const problems = await prisma.sQLProblem.findMany({
            where: {
                status: "PUBLISHED",
                dialects: { has: "POSTGRES" },
                solutionSql: { not: null },
            },
            select: {
                number: true,
                slug: true,
                ordered: true,
                solutionSql: true,
                expectedOutput: true,
                schema: { select: { name: true, sql: true } },
            },
            orderBy: { number: "asc" },
        })

        if (problems.length === 0) {
            console.log("No PUBLISHED problems with POSTGRES in dialects.")
            return
        }

        console.log(`Auditing ${problems.length} problems against PGlite…\n`)

        for (const p of problems) {
            totalAudited++
            const label = `#${p.number} ${p.slug}`

            if (!p.schema?.sql) {
                failures.push({ label, reason: "no schema attached" })
                console.log(`FAIL ${label} :: no schema attached`)
                totalFailed++
                continue
            }
            if (!p.solutionSql) {
                failures.push({ label, reason: "no solutionSql" })
                console.log(`FAIL ${label} :: no solutionSql`)
                totalFailed++
                continue
            }

            let expected: unknown
            try {
                expected = JSON.parse(p.expectedOutput)
            } catch {
                failures.push({
                    label,
                    reason: "expectedOutput is not valid JSON",
                })
                console.log(`FAIL ${label} :: expectedOutput is not valid JSON`)
                totalFailed++
                continue
            }

            const db = new PGlite()
            try {
                await db.waitReady

                const stmts = p.schema.sql
                    .split(/;\s*\n|;\s*$/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)
                for (const stmt of stmts) {
                    try {
                        await db.exec(stmt)
                    } catch (e: any) {
                        throw new Error(
                            `schema setup failed: ${truncate(
                                e?.message ?? String(e)
                            )}`
                        )
                    }
                }

                let result
                try {
                    result = await db.query(p.solutionSql)
                } catch (e: any) {
                    throw new Error(
                        `solution failed: ${truncate(e?.message ?? String(e))}`
                    )
                }

                const verdict = compareResults(result.rows, expected, {
                    ordered: p.ordered,
                })
                if (verdict.ok) {
                    console.log(`OK   ${label}`)
                } else {
                    failures.push({ label, reason: verdict.reason })
                    console.log(`FAIL ${label} :: ${verdict.reason}`)
                    if (verdict.diff?.firstMismatch) {
                        console.log(
                            `       Postgres returned : ${JSON.stringify(verdict.diff.firstMismatch.user)}`
                        )
                        console.log(
                            `       expected          : ${JSON.stringify(verdict.diff.firstMismatch.expected)}`
                        )
                    }
                    totalFailed++
                }
            } catch (e: any) {
                failures.push({ label, reason: e?.message ?? String(e) })
                console.log(`FAIL ${label} :: ${e?.message ?? String(e)}`)
                totalFailed++
            }
        }

        console.log(
            `\n${totalFailed === 0 ? "✓" : "✗"} ${
                totalAudited - totalFailed
            } / ${totalAudited} problems pass in Postgres.`
        )
        if (totalFailed > 0) {
            console.log(`\nFailing problems:`)
            for (const f of failures) {
                console.log(`  - ${f.label} :: ${f.reason}`)
            }
            process.exit(1)
        }
    } finally {
        await prisma.$disconnect()
        await pool.end().catch(() => {})
    }
}

function truncate(s: string, n = 200) {
    return s.length > n ? s.slice(0, n) + "…" : s
}
