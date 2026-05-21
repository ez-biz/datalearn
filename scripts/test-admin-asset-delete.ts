import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import assert from "node:assert/strict"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

async function assertStatus(res: Response, expected: number) {
    if (res.status !== expected) {
        assert.equal(res.status, expected, await res.text())
    }
}

async function main() {
    const adminId = "test-aadmin-1"
    const ownerId = "test-aown-1"
    let articleId: string | undefined
    let topicId: string | undefined

    try {
        for (const [id, role] of [
            [adminId, "ADMIN"],
            [ownerId, "CONTRIBUTOR"],
        ] as const) {
            await prisma.user.upsert({
                where: { id },
                create: { id, email: `${id}@test.local`, role },
                update: { role },
            })
        }

        const topic = await prisma.topic.upsert({
            where: { slug: "test-aadmin-topic" },
            create: { name: "Test Admin Asset Topic", slug: "test-aadmin-topic" },
            update: {},
        })
        topicId = topic.id

        const png = Buffer.from([
            0x89,
            0x50,
            0x4e,
            0x47,
            0x0d,
            0x0a,
            0x1a,
            0x0a,
            ...Array(92).fill(0),
        ])
        const form = new FormData()
        form.append("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "x.png")
        const upRes = await fetch(`${BASE}/api/me/uploads`, {
            method: "POST",
            headers: { "X-Test-User-Id": ownerId },
            body: form,
        })
        await assertStatus(upRes, 200)
        const up = (await upRes.json()) as { id: string; url: string }

        const article = await prisma.article.create({
            data: {
                title: "Demo",
                slug: `demo-aadmin-${Date.now()}`,
                status: "PUBLISHED",
                content: `# Demo\n\n:::figure{src="${up.url}" alt="x"}\nx\n:::\n\nbody`,
                authorId: ownerId,
                topicId: topic.id,
            },
        })
        articleId = article.id

        const del = await fetch(`${BASE}/api/admin/assets/${up.id}`, {
            method: "DELETE",
            headers: { "X-Test-User-Id": adminId },
        })
        await assertStatus(del, 200)
        const body = (await del.json()) as {
            blobDeleted: boolean
            status: string
            affectedArticles: { slug: string; snapshotVersion?: number }[]
        }
        assert.equal(body.blobDeleted, true)
        assert.equal(body.status, "DELETED")
        assert.deepEqual(
            body.affectedArticles.map((article) => article.slug),
            [article.slug]
        )
        assert.ok(body.affectedArticles[0].snapshotVersion !== undefined)

        const after = await prisma.article.findUniqueOrThrow({ where: { id: article.id } })
        assert.equal(after.content.includes(up.url), false, "URL must be stripped")

        const quota = await prisma.userAssetQuota.findUniqueOrThrow({
            where: { userId: ownerId },
        })
        assert.equal(quota.reservedBytes, BigInt(0), "quota must be released")

        const asset = await prisma.asset.findUniqueOrThrow({ where: { id: up.id } })
        assert.ok(asset.quotaReleasedAt, "quota release marker must be set")
    } finally {
        if (articleId) {
            await prisma.articleVersion.deleteMany({ where: { articleId } })
            await prisma.article.delete({ where: { id: articleId } })
        }
        if (topicId) await prisma.topic.delete({ where: { id: topicId } })
        await prisma.asset.deleteMany({ where: { ownerId } })
        await prisma.userAssetQuota.deleteMany({ where: { userId: ownerId } })
        await prisma.user.deleteMany({ where: { id: { in: [adminId, ownerId] } } })
    }

    console.log("test-admin-asset-delete PASS")
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
