import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import assert from "node:assert/strict"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

async function runGc() {
    const res = await fetch(`${BASE}/api/cron/asset-gc`, {
        method: "GET",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    })
    if (!res.ok) throw new Error(`gc failed: ${res.status} ${await res.text()}`)
    return res.json()
}

async function main() {
    if (process.env.DATALEARN_FAKE_BLOB !== "1") {
        console.log("SKIP - restart next dev and this test with DATALEARN_FAKE_BLOB=1")
        return
    }

    const userId = "test-gc-user"
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: `${userId}@test.local`, role: "CONTRIBUTOR" },
        update: {},
    })

    try {
        const oldDeleted = await prisma.asset.create({
            data: {
                ownerId: userId,
                blobUrl: "https://store.vercel-storage.com/learn/_test_/gc-old-tombstone.svg",
                blobKey: "learn/_test_/gc-old-tombstone.svg",
                contentType: "image/svg+xml",
                bytes: 100,
                status: "DELETED",
                deletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            },
        })
        const deleting = await prisma.asset.create({
            data: {
                ownerId: userId,
                blobUrl: "https://store.vercel-storage.com/learn/_test_/gc-deleting.svg",
                blobKey: "learn/_test_/gc-deleting.svg",
                contentType: "image/svg+xml",
                bytes: 100,
                status: "DELETING",
                deletedAt: new Date(),
                deletionAttempts: 4,
                lastDeletionError: "previous failure",
            },
        })
        const alreadyReleased = await prisma.asset.create({
            data: {
                ownerId: userId,
                blobUrl: "https://store.vercel-storage.com/learn/_test_/gc-already-released.svg",
                blobKey: "learn/_test_/gc-already-released.svg",
                contentType: "image/svg+xml",
                bytes: 80,
                status: "DELETED",
                deletedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
                quotaReleasedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            },
        })
        const expiredPending = await prisma.asset.create({
            data: {
                ownerId: userId,
                blobUrl: null,
                blobKey: "learn/_test_/gc-expired-pending.svg",
                contentType: "image/svg+xml",
                bytes: 50,
                status: "PENDING",
                pendingExpiresAt: new Date(Date.now() - 60_000),
            },
        })
        await prisma.asset.create({
            data: {
                ownerId: userId,
                blobUrl: "https://store.vercel-storage.com/learn/_test_/gc-active.svg",
                blobKey: "learn/_test_/gc-active.svg",
                contentType: "image/svg+xml",
                bytes: 100,
                status: "ACTIVE",
            },
        })

        await prisma.userAssetQuota.upsert({
            where: { userId },
            create: { userId, reservedBytes: BigInt(350) },
            update: { reservedBytes: BigInt(350) },
        })

        const result = await runGc()
        assert.equal(result.sweep, "complete")

        const stillOld = await prisma.asset.findUnique({ where: { id: oldDeleted.id } })
        assert.equal(stillOld, null, "old tombstone should be hard-deleted")

        const stillAlreadyReleased = await prisma.asset.findUnique({
            where: { id: alreadyReleased.id },
        })
        assert.equal(
            stillAlreadyReleased,
            null,
            "already-released tombstone should be hard-deleted without releasing quota again"
        )

        const finalizedDeleting = await prisma.asset.findUniqueOrThrow({
            where: { id: deleting.id },
        })
        assert.equal(finalizedDeleting.status, "DELETED")
        assert.equal(finalizedDeleting.lastDeletionError, null)

        const stillPending = await prisma.asset.findUnique({
            where: { id: expiredPending.id },
        })
        assert.equal(stillPending, null, "expired PENDING with no blob should be removed")

        const finalQuota = await prisma.userAssetQuota.findUniqueOrThrow({
            where: { userId },
        })
        assert.equal(
            finalQuota.reservedBytes,
            BigInt(100),
            "quota should retain bytes for the unrelated ACTIVE asset"
        )
    } finally {
        await prisma.asset.deleteMany({ where: { ownerId: userId } })
        await prisma.userAssetQuota.deleteMany({ where: { userId } })
        await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }

    console.log("test-asset-gc PASS")
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
