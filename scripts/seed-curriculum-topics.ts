/**
 * Idempotent seed for the v1 curriculum topic spine.
 *
 * - Creates missing topics in both lanes with the assigned displayOrder.
 * - Backfills lane + displayOrder on any topic that already exists with
 *   the same slug (e.g. joins, window-functions, data-engineering-101).
 * - Never deletes anything.
 *
 * Run: npm run seed:curriculum-topics
 */
import "dotenv/config"
import { prisma } from "../lib/prisma"

type CurriculumTopic = {
    slug: string
    name: string
    description: string
    lane: "SQL" | "DATA_ENGINEERING"
    displayOrder: number
}

const TOPICS: CurriculumTopic[] = [
    // SQL lane (displayOrder 1..6)
    {
        slug: "sql-foundations",
        name: "SQL Foundations",
        description:
            "The mental model behind SELECT, WHERE, ORDER BY, and LIMIT.",
        lane: "SQL",
        displayOrder: 1,
    },
    {
        slug: "joins",
        name: "Joins",
        description: "How relational engines combine rows across tables.",
        lane: "SQL",
        displayOrder: 2,
    },
    {
        slug: "aggregations",
        name: "Aggregations & GROUP BY",
        description:
            "Reducing many rows to a few — and the silent NULL traps in HAVING.",
        lane: "SQL",
        displayOrder: 3,
    },
    {
        slug: "ctes-and-subqueries",
        name: "CTEs & Subqueries",
        description:
            "WITH clauses, correlated subqueries, and when each one is the right answer.",
        lane: "SQL",
        displayOrder: 4,
    },
    {
        slug: "window-functions",
        name: "Window Functions",
        description:
            "Annotating rows with running totals, ranks, and lag/lead, without collapsing them.",
        lane: "SQL",
        displayOrder: 5,
    },
    {
        slug: "query-performance",
        name: "Query Performance",
        description:
            "EXPLAIN plans, indexes, and the moments when denormalization wins.",
        lane: "SQL",
        displayOrder: 6,
    },

    // DE lane (displayOrder 7..10)
    {
        slug: "data-engineering-101",
        name: "Data Engineering 101",
        description:
            "The vocabulary every data engineer needs: OLTP vs OLAP, ETL, batch vs stream.",
        lane: "DATA_ENGINEERING",
        displayOrder: 7,
    },
    {
        slug: "storage-and-modeling",
        name: "Storage & Modeling",
        description:
            "Dimensional modeling, partitioning, and the file formats that make analytics fast.",
        lane: "DATA_ENGINEERING",
        displayOrder: 8,
    },
    {
        slug: "pipelines-and-movement",
        name: "Pipelines & Movement",
        description:
            "Orchestration concepts, dependencies, CDC — without naming any specific tool.",
        lane: "DATA_ENGINEERING",
        displayOrder: 9,
    },
    {
        slug: "data-quality",
        name: "Data Quality",
        description:
            "Idempotency, slowly changing dimensions, and how to know your pipeline is honest.",
        lane: "DATA_ENGINEERING",
        displayOrder: 10,
    },
]

async function main() {
    let created = 0
    let updated = 0
    for (const t of TOPICS) {
        const result = await prisma.topic.upsert({
            where: { slug: t.slug },
            create: {
                slug: t.slug,
                name: t.name,
                description: t.description,
                lane: t.lane,
                displayOrder: t.displayOrder,
            },
            update: {
                // Only force lane + displayOrder to match the spec.
                // Preserve description if the existing one is non-null and
                // non-empty (humans might have edited it).
                lane: t.lane,
                displayOrder: t.displayOrder,
            },
            select: { slug: true, createdAt: true, updatedAt: true },
        })
        if (result.createdAt.getTime() === result.updatedAt.getTime()) {
            created += 1
            console.log(`  + created ${result.slug}`)
        } else {
            updated += 1
            console.log(`  · updated ${result.slug}`)
        }
    }
    console.log(`done. created=${created} updated=${updated} total=${TOPICS.length}`)
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
