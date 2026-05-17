#!/usr/bin/env node
// Tag taxonomy audit — lists all tags with PUBLISHED problem counts and flags
// potential duplicates (case variants, plural/singular, spacing differences).
//
// Usage:
//   DATABASE_URL='<url>' npx tsx scripts/audit-tags.ts
// Or with local DB (uses .env via dotenv/config):
//   npx tsx scripts/audit-tags.ts

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

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

    try {
        const tags = await prisma.tag.findMany({
            select: {
                slug: true,
                name: true,
                kind: true,
                _count: {
                    select: {
                        problems: true,
                    },
                },
                problems: {
                    where: { status: "PUBLISHED" },
                    select: { id: true },
                },
            },
            orderBy: { name: "asc" },
        })

        const totalTags = tags.length
        const withPublished = tags.filter((t) => t.problems.length > 0)
        const withoutPublished = tags.filter((t) => t.problems.length === 0)

        console.log(
            `\n── Tag Audit ──────────────────────────────────────────────`,
        )
        console.log(`Total tags: ${totalTags}`)
        console.log(`  With published problems: ${withPublished.length}`)
        console.log(
            `  With no published problems (ghost): ${withoutPublished.length}`,
        )
        console.log()

        // Sort by published count desc, then name asc
        const sorted = [...tags].sort((a, b) => {
            const diff = b.problems.length - a.problems.length
            return diff !== 0 ? diff : a.name.localeCompare(b.name)
        })

        console.log(
            `── All tags (by kind and published problem count) ─────────`,
        )
        printTagTable(
            "Companies",
            sorted.filter((t) => t.kind === "COMPANY"),
        )
        printTagTable(
            "Topics",
            sorted.filter((t) => t.kind === "TOPIC"),
        )

        // Duplicate detection: normalize to lower-case, strip hyphens/spaces
        console.log(
            `\n── Potential duplicates ───────────────────────────────────`,
        )
        const groups = new Map<string, typeof tags>()
        for (const t of tags) {
            const key = `${t.kind}:${t.name.toLowerCase().replace(/[-_\s]+/g, "")}`
            const group = groups.get(key) ?? []
            group.push(t)
            groups.set(key, group)
        }
        const dupes = [...groups.values()].filter((g) => g.length > 1)
        if (dupes.length === 0) {
            console.log("No potential duplicates found.")
        } else {
            console.log(
                `${dupes.length} group(s) with similar names — consolidate before launch:\n`,
            )
            for (const group of dupes) {
                console.log(
                    `  Group (${group[0]?.kind.toLowerCase()}): ${group.map((t) => `"${t.name}" (${t.problems.length} published)`).join(" vs ")}`,
                )
                console.log(`  Slugs: ${group.map((t) => t.slug).join(", ")}`)
                console.log()
            }
        }

        if (withoutPublished.length > 0) {
            console.log(
                `── Ghost tags (0 published problems) ──────────────────────`,
            )
            for (const t of withoutPublished) {
                console.log(
                    `  "${t.name}" (slug: ${t.slug}, total: ${t._count.problems})`,
                )
            }
            console.log()
        }

        console.log(
            `── Done ────────────────────────────────────────────────────\n`,
        )
    } finally {
        await prisma.$disconnect()
        await pool.end().catch(() => {})
    }
}

function printTagTable(
    label: string,
    tags: Array<{
        slug: string
        name: string
        _count: { problems: number }
        problems: { id: string }[]
    }>,
) {
    console.log(`\n${label}`)
    if (tags.length === 0) {
        console.log("  none")
        return
    }

    const maxName = Math.max(...tags.map((t) => t.name.length), 4)
    const maxSlug = Math.max(...tags.map((t) => t.slug.length), 4)
    console.log(
        `${"NAME".padEnd(maxName)}  ${"SLUG".padEnd(maxSlug)}  TOTAL  PUBLISHED`,
    )
    console.log("─".repeat(maxName + maxSlug + 20))
    for (const t of tags) {
        const total = t._count.problems
        const published = t.problems.length
        const ghost = published === 0 ? "  ⚠ no published problems" : ""
        console.log(
            `${t.name.padEnd(maxName)}  ${t.slug.padEnd(maxSlug)}  ${String(total).padStart(5)}  ${String(published).padStart(9)}${ghost}`,
        )
    }
}
