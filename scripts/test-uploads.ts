import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import assert from "node:assert/strict"
import pg from "pg"

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })
const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"

async function seedUser(role: "ADMIN" | "CONTRIBUTOR" | "USER") {
    const id = `test-uploads-${role.toLowerCase()}`
    await prisma.user.upsert({
        where: { id },
        create: { id, email: `${id}@test.local`, role },
        update: { role },
    })
    return id
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
    form.append("file", new Blob([body], { type }), filename)
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
    const userIds = [adminId, contributorId, learnerId]

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
        assert.equal(okRes.status, 200, await okRes.text())
        const okBody = (await okRes.json()) as {
            id: string
            url: string
            bytes: number
        }
        assert.ok(
            okBody.url.includes(".vercel-storage.com") ||
                okBody.url.includes(".vercel-blob")
        )
        assert.equal(okBody.bytes, 100)

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
