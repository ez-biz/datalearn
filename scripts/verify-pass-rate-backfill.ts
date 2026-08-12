// Verify the denormalized pass-rate counters against the Submission table.
//
// This recomputes the aggregate and compares VALUES. Checking that the
// columns exist and are non-zero would pass for a backfill that double-counts
// every row, which is exactly the failure this guards against.
//
// Run: DATABASE_URL=... npx tsx scripts/verify-pass-rate-backfill.ts
//
// Exits 1 and prints every mismatch when the counters have drifted, so it is
// usable both right after the migration and later as a drift check.
//
// Drift is expected over time, not hypothetical: deleting a User cascades
// their Submissions away, but nothing decrements the counters — a deleted
// account leaves every problem it attempted permanently overcounted. Pass
// `--fix` to recompute the stored values from the Submission table.

import { prisma } from "../lib/prisma"

type Mismatch = {
    slug: string
    stored: { attempts: number; accepted: number }
    actual: { attempts: number; accepted: number }
}

async function main() {
    const problems = await prisma.sQLProblem.findMany({
        select: {
            id: true,
            slug: true,
            attemptCount: true,
            acceptedCount: true,
        },
    })

    const grouped = await prisma.submission.groupBy({
        by: ["problemId", "status"],
        _count: { _all: true },
    })

    const actual = new Map<string, { attempts: number; accepted: number }>()
    for (const row of grouped) {
        const entry = actual.get(row.problemId) ?? { attempts: 0, accepted: 0 }
        entry.attempts += row._count._all
        if (row.status === "ACCEPTED") entry.accepted += row._count._all
        actual.set(row.problemId, entry)
    }

    const mismatches: Mismatch[] = []
    for (const p of problems) {
        const real = actual.get(p.id) ?? { attempts: 0, accepted: 0 }
        if (
            p.attemptCount !== real.attempts ||
            p.acceptedCount !== real.accepted
        ) {
            mismatches.push({
                slug: p.slug,
                stored: { attempts: p.attemptCount, accepted: p.acceptedCount },
                actual: real,
            })
        }
    }

    if (mismatches.length > 0) {
        const fix = process.argv.includes("--fix")
        console.error(
            `${mismatches.length} of ${problems.length} problems have drifted counters:`
        )
        for (const m of mismatches) {
            console.error(
                `  ${m.slug}  stored=(${m.stored.attempts},${m.stored.accepted}) actual=(${m.actual.attempts},${m.actual.accepted})`
            )
        }
        if (!fix) {
            console.error("\nRe-run with --fix to recompute from Submission.")
            process.exit(1)
        }
        for (const m of mismatches) {
            await prisma.sQLProblem.update({
                where: { slug: m.slug },
                data: {
                    attemptCount: m.actual.attempts,
                    acceptedCount: m.actual.accepted,
                },
            })
        }
        console.log(`Repaired ${mismatches.length} problems.`)
        return
    }

    const withData = problems.filter((p) => p.attemptCount > 0).length
    console.log(
        `${problems.length} problems checked, all counters match ` +
            `(${withData} with at least one submission).`
    )
}

main()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("verify-pass-rate-backfill failed:", err)
        process.exit(1)
    })
