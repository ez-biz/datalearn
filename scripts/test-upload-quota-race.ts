import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import assert from "node:assert/strict"
import pg from "pg"
import {
    ensureQuotaRow,
    reserveBytes,
    releaseBytes,
    QUOTA_BYTES,
} from "../lib/uploads/quota"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const userId = "test-quota-race-user"
    await prisma.userAssetQuota.deleteMany({ where: { userId } })
    await prisma.user.upsert({
        where: { id: userId },
        create: { id: userId, email: `${userId}@test.local`, role: "CONTRIBUTOR" },
        update: {},
    })

    await ensureQuotaRow(prisma, userId)

    const size = 15 * 1024 * 1024
    const attempts = 10
    const results = await Promise.all(
        Array.from({ length: attempts }, () => reserveBytes(prisma, userId, size))
    )

    const ok = results.filter(Boolean).length
    const expected = Math.floor(QUOTA_BYTES / size)
    assert.equal(ok, expected, `expected ${expected} successes, got ${ok}`)

    const row = await prisma.userAssetQuota.findUniqueOrThrow({ where: { userId } })
    assert.equal(row.reservedBytes, BigInt(size * expected))

    await releaseBytes(prisma, userId, size)
    const refresh = await reserveBytes(prisma, userId, size)
    assert.equal(refresh, true)

    await prisma.userAssetQuota.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
    console.log("test-upload-quota-race PASS")
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
