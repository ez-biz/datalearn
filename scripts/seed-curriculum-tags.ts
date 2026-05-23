/**
 * Idempotent seed for the v1 curriculum concept tags.
 *
 * Creates ~28 TagKind=TOPIC tags used as cross-cutting concept markers
 * on Articles and SQLProblems. Re-running is safe; existing tags are
 * not modified.
 *
 * Run: npm run seed:curriculum-tags
 */
import "dotenv/config"
import { prisma } from "../lib/prisma"

type ConceptTag = { slug: string; name: string }

const SQL_TAGS: ConceptTag[] = [
    { slug: "inner-join", name: "Inner Join" },
    { slug: "left-join", name: "Left Join" },
    { slug: "anti-join", name: "Anti Join" },
    { slug: "semi-join", name: "Semi Join" },
    { slug: "group-by", name: "Group By" },
    { slug: "having", name: "HAVING" },
    { slug: "partition-by", name: "Partition By" },
    { slug: "frame-clause", name: "Frame Clause" },
    { slug: "ranking-functions", name: "Ranking Functions" },
    { slug: "recursive-cte", name: "Recursive CTE" },
    { slug: "correlated-subquery", name: "Correlated Subquery" },
    { slug: "explain-plan", name: "EXPLAIN Plan" },
    { slug: "index-usage", name: "Index Usage" },
    { slug: "null-handling", name: "NULL Handling" },
]

const DE_TAGS: ConceptTag[] = [
    { slug: "dimensional-modeling", name: "Dimensional Modeling" },
    { slug: "star-schema", name: "Star Schema" },
    { slug: "scd-type-2", name: "SCD Type 2" },
    { slug: "cdc", name: "CDC" },
    { slug: "idempotency", name: "Idempotency" },
    { slug: "partitioning", name: "Partitioning" },
    { slug: "parquet", name: "Parquet" },
    { slug: "oltp", name: "OLTP" },
    { slug: "olap", name: "OLAP" },
    { slug: "etl", name: "ETL" },
    { slug: "elt", name: "ELT" },
    { slug: "stream-processing", name: "Stream Processing" },
    { slug: "orchestration", name: "Orchestration" },
    { slug: "data-quality", name: "Data Quality" },
]

const ALL = [...SQL_TAGS, ...DE_TAGS]

async function main() {
    let created = 0
    let skipped = 0
    for (const t of ALL) {
        try {
            await prisma.tag.create({
                data: { slug: t.slug, name: t.name, kind: "TOPIC" },
            })
            created += 1
            console.log(`  + ${t.slug}`)
        } catch (err: any) {
            if (err?.code === "P2002") {
                skipped += 1
                continue
            }
            throw err
        }
    }
    console.log(`done. created=${created} skipped=${skipped} total=${ALL.length}`)
}

main()
    .catch((err) => {
        console.error(err)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
