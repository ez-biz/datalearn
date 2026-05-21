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
    if (process.env.DATALEARN_FORCE_DEL_FAILURE !== "1") {
        console.log(
            "SKIP - restart next dev and this test with DATALEARN_FORCE_DEL_FAILURE=1"
        )
        return
    }

    const adminId = "test-retry-admin"
    const ownerId = "test-retry-own"
    let assetId: string | undefined

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
        await prisma.userAssetQuota.upsert({
            where: { userId: ownerId },
            create: { userId: ownerId, reservedBytes: BigInt(100) },
            update: { reservedBytes: BigInt(100) },
        })
        const asset = await prisma.asset.create({
            data: {
                ownerId,
                blobUrl: `https://store.vercel-storage.com/learn/${ownerId}/retry-${Date.now()}.png`,
                blobKey: `learn/${ownerId}/retry-${Date.now()}.png`,
                contentType: "image/png",
                bytes: 100,
                status: "ACTIVE",
            },
        })
        assetId = asset.id

        const del = await fetch(`${BASE}/api/admin/assets/${asset.id}`, {
            method: "DELETE",
            headers: { "X-Test-User-Id": adminId },
        })
        await assertStatus(del, 502)
        const body = (await del.json()) as {
            status: string
            blobDeleted: boolean
            retryAttempts: number
        }
        assert.equal(body.status, "DELETING")
        assert.equal(body.blobDeleted, false)
        assert.ok(body.retryAttempts >= 4)

        const after = await prisma.asset.findUniqueOrThrow({ where: { id: asset.id } })
        assert.equal(after.status, "DELETING")
        assert.ok(after.deletionAttempts >= 4)
        assert.ok(after.lastDeletionError != null)

        const quota = await prisma.userAssetQuota.findUniqueOrThrow({
            where: { userId: ownerId },
        })
        assert.equal(quota.reservedBytes > BigInt(0), true)
    } finally {
        if (assetId) await prisma.asset.deleteMany({ where: { id: assetId } })
        await prisma.userAssetQuota.deleteMany({ where: { userId: ownerId } })
        await prisma.user.deleteMany({ where: { id: { in: [adminId, ownerId] } } })
    }

    console.log("test-admin-asset-delete-retry PASS")
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
