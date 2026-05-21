import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import assert from "node:assert/strict"
import pg from "pg"
import { ensureQuotaRow, reserveBytes } from "../lib/uploads/quota"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const userId = "test-phase1-atomic"
    await prisma.asset.deleteMany({ where: { ownerId: userId } })
    await prisma.userAssetQuota.deleteMany({ where: { userId } })
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: `${userId}@test.local`, role: "CONTRIBUTOR" },
        update: {},
    })
    await ensureQuotaRow(prisma, userId)

    const before = await prisma.userAssetQuota.findUniqueOrThrow({
        where: { userId },
    })
    assert.equal(before.reservedBytes, 0n)

    const attemptBytes = 1024
    const duplicateId = "duplicate-id-for-phase1-test"
    await prisma.asset.create({
        data: {
            id: duplicateId,
            ownerId: userId,
            blobKey: `learn/${userId}/${duplicateId}.png`,
            contentType: "image/png",
            bytes: 0,
            status: "DELETED",
        },
    })

    let threw = false
    try {
        await prisma.$transaction(async (tx) => {
            const ok = await reserveBytes(tx, userId, attemptBytes)
            assert.equal(ok, true, "reservation should have succeeded")
            await tx.asset.create({
                data: {
                    id: duplicateId,
                    ownerId: userId,
                    blobKey: `learn/${userId}/other.png`,
                    contentType: "image/png",
                    bytes: attemptBytes,
                    status: "PENDING",
                },
            })
        })
    } catch {
        threw = true
    }
    assert.equal(threw, true, "transaction was expected to throw")

    const after = await prisma.userAssetQuota.findUniqueOrThrow({
        where: { userId },
    })
    assert.equal(
        after.reservedBytes,
        0n,
        `quota must be restored, got ${after.reservedBytes}`
    )

    await prisma.asset.deleteMany({ where: { ownerId: userId } })
    await prisma.userAssetQuota.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    console.log("test-upload-phase1-atomicity PASS")
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
