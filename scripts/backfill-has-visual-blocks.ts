import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { validateArticleDirectivesSyntactic } from "../lib/admin-validation"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    let cursor: string | undefined
    let scanned = 0
    let updated = 0

    for (;;) {
        const batch = await prisma.article.findMany({
            where: { status: "PUBLISHED" },
            orderBy: { id: "asc" },
            take: 100,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            select: { id: true, content: true, hasVisualBlocks: true },
        })
        if (batch.length === 0) break

        for (const article of batch) {
            scanned++
            const result = validateArticleDirectivesSyntactic(article.content)
            if (result.hasVisualBlocks !== article.hasVisualBlocks) {
                await prisma.article.update({
                    where: { id: article.id },
                    data: { hasVisualBlocks: result.hasVisualBlocks },
                })
                updated++
            }
        }

        cursor = batch[batch.length - 1].id
    }

    console.log(`backfill complete: scanned=${scanned}, updated=${updated}`)
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
