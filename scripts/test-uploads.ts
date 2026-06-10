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

function isExpectedBlobUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return (
            url.protocol === "https:" &&
            (url.hostname === "store.vercel-storage.com" ||
                url.hostname.endsWith(".vercel-storage.com") ||
                url.hostname.endsWith(".vercel-blob.com"))
        )
    } catch {
        return false
    }
}

async function seedUser(role: "ADMIN" | "CONTRIBUTOR" | "USER") {
    const id = `test-uploads-${role.toLowerCase()}`
    await prisma.user.upsert({
        where: { id },
        create: { id, email: `${id}@test.local`, role },
        update: { role },
    })
    return id
}

async function seedAssets(ownerId: string, count: number, createdAt: Date) {
    await prisma.asset.createMany({
        data: Array.from({ length: count }, (_, i) => ({
            ownerId,
            blobKey: `test-uploads-rate/${ownerId}/${createdAt.getTime()}-${i}`,
            contentType: "image/png",
            bytes: 1,
            status: "ACTIVE" as const,
            createdAt,
        })),
    })
}

function makeAuthedFetch(userId: string) {
    return async (path: string, init?: RequestInit) =>
        fetch(`${BASE}${path}`, {
            ...init,
            headers: { ...init?.headers, "X-Test-User-Id": userId },
        })
}

async function postFile(
    authedFetch: (path: string, init?: RequestInit) => Promise<Response>,
    filename: string,
    type: string,
    body: Buffer
) {
    const form = new FormData()
    form.append("file", new Blob([new Uint8Array(body)], { type }), filename)
    return authedFetch("/api/me/uploads", { method: "POST", body: form })
}

async function cleanup(userIds: string[]) {
    await prisma.asset.deleteMany({ where: { ownerId: { in: userIds } } })
    await prisma.userAssetQuota.deleteMany({ where: { userId: { in: userIds } } })
    await prisma.user.deleteMany({ where: { id: { in: userIds } } })
}

async function main() {
    const adminId = await seedUser("ADMIN")
    const contributorId = await seedUser("CONTRIBUTOR")
    const learnerId = await seedUser("USER")
    const rateId = `test-uploads-rate`
    await prisma.user.upsert({
        where: { id: rateId },
        create: { id: rateId, email: `${rateId}@test.local`, role: "CONTRIBUTOR" },
        update: { role: "CONTRIBUTOR" },
    })
    const userIds = [adminId, contributorId, learnerId, rateId]

    try {
        const contributorFetch = makeAuthedFetch(contributorId)
        const learnerFetch = makeAuthedFetch(learnerId)

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
        const okRes = await postFile(contributorFetch, "hi.png", "image/png", png)
        await assertStatus(okRes, 200)
        const okBody = (await okRes.json()) as {
            id: string
            url: string
            bytes: number
        }
        assert.ok(isExpectedBlobUrl(okBody.url))
        assert.equal(okBody.bytes, 100)

        const listRes = await contributorFetch("/api/me/uploads")
        await assertStatus(listRes, 200)
        const listBody = (await listRes.json()) as {
            items: { id: string; blobUrl: string; bytes: number }[]
        }
        assert.ok(
            listBody.items.some(
                (item) => item.id === okBody.id && item.bytes === okBody.bytes
            ),
            "owner upload list should include the newly uploaded asset"
        )

        const txt = await postFile(
            contributorFetch,
            "evil.txt",
            "text/plain",
            Buffer.from("nope")
        )
        assert.equal(txt.status, 415)

        const big = Buffer.alloc(5 * 1024 * 1024, 0)
        const bigRes = await postFile(contributorFetch, "big.png", "image/png", big)
        assert.equal(bigRes.status, 413)

        const learnerRes = await postFile(
            learnerFetch,
            "hi.png",
            "image/png",
            png
        )
        assert.equal(learnerRes.status, 403)

        // Rate limiting is DB-backed: counts Asset rows in the window, so it
        // holds across serverless instances. 10/minute, 50/day.
        const rateFetch = makeAuthedFetch(rateId)
        const MINUTE_MS = 60_000
        const DAY_MS = 24 * 60 * MINUTE_MS

        await seedAssets(rateId, 10, new Date())
        const minuteLimited = await postFile(rateFetch, "hi.png", "image/png", png)
        assert.equal(minuteLimited.status, 429)
        const minuteBody = (await minuteLimited.json()) as {
            error: string
            retryAfterMs: number
        }
        assert.equal(minuteBody.error, "rate-limited")
        assert.ok(
            minuteBody.retryAfterMs > 0 && minuteBody.retryAfterMs <= MINUTE_MS,
            `minute retryAfterMs out of range: ${minuteBody.retryAfterMs}`
        )

        // Age the rows out of the minute window; uploads should resume.
        await prisma.asset.updateMany({
            where: { ownerId: rateId },
            data: { createdAt: new Date(Date.now() - 2 * MINUTE_MS) },
        })
        const resumed = await postFile(rateFetch, "hi.png", "image/png", png)
        await assertStatus(resumed, 200)

        // Fill the daily window (11 rows so far) and verify the 50/day cap.
        await seedAssets(rateId, 39, new Date(Date.now() - 2 * 60 * MINUTE_MS))
        const dayLimited = await postFile(rateFetch, "hi.png", "image/png", png)
        assert.equal(dayLimited.status, 429)
        const dayBody = (await dayLimited.json()) as {
            error: string
            retryAfterMs: number
        }
        assert.equal(dayBody.error, "rate-limited")
        assert.ok(
            dayBody.retryAfterMs > 0 && dayBody.retryAfterMs <= DAY_MS,
            `day retryAfterMs out of range: ${dayBody.retryAfterMs}`
        )
    } finally {
        await cleanup(userIds)
    }

    console.log("test-uploads PASS")
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
