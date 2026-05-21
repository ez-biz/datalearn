import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import assert from "node:assert/strict"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

async function seedUserAndAsset(role: "CONTRIBUTOR" | "ADMIN") {
    const userId = `test-delref-${role.toLowerCase()}-${Date.now()}`
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: `${userId}@test.local`, role },
        update: { role },
    })
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const asset = await prisma.asset.create({
        data: {
            ownerId: userId,
            blobUrl: `https://store.vercel-storage.com/learn/${userId}/test-${suffix}.svg`,
            blobKey: `learn/${userId}/test-${suffix}.svg`,
            contentType: "image/svg+xml",
            bytes: 100,
            status: "ACTIVE",
        },
    })
    return { userId, asset }
}

async function main() {
    const seededUserIds: string[] = []
    let topicId: string | undefined
    let articleId: string | undefined

    try {
        const { userId: u1, asset: a1 } = await seedUserAndAsset("CONTRIBUTOR")
        seededUserIds.push(u1)
        const del1 = await fetch(`${BASE}/api/me/uploads/${a1.id}`, {
            method: "DELETE",
            headers: { "X-Test-User-Id": u1 },
        })
        assert.equal(del1.status, 204)
        const after1 = await prisma.asset.findUniqueOrThrow({ where: { id: a1.id } })
        assert.equal(after1.status, "DELETED")

        const { userId: u2, asset: a2 } = await seedUserAndAsset("CONTRIBUTOR")
        seededUserIds.push(u2)
        const topic = await prisma.topic.upsert({
            where: { slug: "test-topic-delref" },
            create: { name: "Test Topic Delref", slug: "test-topic-delref" },
            update: {},
        })
        topicId = topic.id
        const article = await prisma.article.create({
            data: {
                title: "Refholder",
                slug: `refholder-${Date.now()}`,
                status: "PUBLISHED",
                content: `:::figure{src="${a2.blobUrl}" alt="x"}\nx\n:::\n`,
                authorId: u2,
                topicId: topic.id,
            },
        })
        articleId = article.id

        const del2 = await fetch(`${BASE}/api/me/uploads/${a2.id}`, {
            method: "DELETE",
            headers: { "X-Test-User-Id": u2 },
        })
        assert.equal(del2.status, 409)
        const body = (await del2.json()) as {
            error: string
            articles: { slug: string }[]
        }
        assert.equal(body.error, "asset-in-use")
        assert.deepEqual(
            body.articles.map((a) => a.slug).sort(),
            [article.slug]
        )
        const stillActive = await prisma.asset.findUniqueOrThrow({
            where: { id: a2.id },
        })
        assert.equal(stillActive.status, "ACTIVE")
    } finally {
        if (articleId) await prisma.article.delete({ where: { id: articleId } })
        if (topicId) await prisma.topic.delete({ where: { id: topicId } })
        await prisma.asset.deleteMany({ where: { ownerId: { in: seededUserIds } } })
        await prisma.userAssetQuota.deleteMany({
            where: { userId: { in: seededUserIds } },
        })
        await prisma.user.deleteMany({ where: { id: { in: seededUserIds } } })
    }

    console.log("test-asset-delete-references PASS")
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
