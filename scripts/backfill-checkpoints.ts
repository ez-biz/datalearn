// Backfill LessonCheckpoint from Article.relatedProblems.
//
// Dry run (default):  npx tsx scripts/backfill-checkpoints.ts
// Apply:              npx tsx scripts/backfill-checkpoints.ts --apply
//
// Existing LessonCheckpoint rows are left alone — the script only creates
// rows for problems that don't already check a lesson.

import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { planCheckpointBackfill, type BackfillPair } from "../lib/checkpoint-backfill"

const apply = process.argv.includes("--apply")

async function main() {
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

    const articles = await prisma.article.findMany({
        select: {
            id: true,
            createdAt: true,
            relatedProblems: { select: { id: true } },
        },
    })

    const alreadyChecked = new Set(
        (
            await prisma.lessonCheckpoint.findMany({ select: { problemId: true } })
        ).map((c) => c.problemId),
    )

    const pairs: BackfillPair[] = articles.flatMap((a) =>
        a.relatedProblems
            .filter((p) => !alreadyChecked.has(p.id))
            .map((p) => ({
                articleId: a.id,
                articleCreatedAt: a.createdAt,
                problemId: p.id,
            })),
    )

    const plan = planCheckpointBackfill(pairs)

    console.log(`pairs considered: ${pairs.length}`)
    console.log(`checkpoints to create: ${plan.create.length}`)
    console.log(`pairs skipped (problem already claimed): ${plan.skipped.length}`)
    for (const s of plan.skipped) {
        console.log(
            `  SKIP problem=${s.problemId} kept=${s.keptArticleId} dropped=${s.droppedArticleId}`,
        )
    }

    if (!apply) {
        console.log("\nDry run. Re-run with --apply to write.")
        await prisma.$disconnect()
        await pool.end()
        return
    }

    for (const row of plan.create) {
        await prisma.lessonCheckpoint.create({ data: row })
    }
    console.log(`\nCreated ${plan.create.length} checkpoints.`)

    await prisma.$disconnect()
    await pool.end()
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
