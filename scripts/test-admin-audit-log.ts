import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { recordAdminAction } from "../lib/admin-audit-log"

const PREFIX = "audit-log-test-"

let pool: pg.Pool
let prisma: PrismaClient
let actorId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for admin audit log tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await prisma.adminAuditLog.deleteMany({
        where: { actor: { email: { startsWith: PREFIX } } },
    })
    await prisma.user.deleteMany({
        where: { email: { startsWith: PREFIX } },
    })

    const admin = await prisma.user.create({
        data: { email: `${PREFIX}admin@example.com`, role: "ADMIN" },
    })
    actorId = admin.id
})

after(async () => {
    await prisma?.adminAuditLog.deleteMany({ where: { actorId } })
    await prisma?.user.deleteMany({ where: { id: actorId } })
    await prisma?.$disconnect()
    await pool?.end().catch(() => {})
})

describe("recordAdminAction", () => {
    it("inserts an audit row", async () => {
        await recordAdminAction(prisma, {
            actorId,
            action: "REVEAL_HIDDEN_TEST",
            targetType: "SQLProblem",
            targetId: "ckTest",
            metadata: { dialect: "DUCKDB" },
        })

        const row = await prisma.adminAuditLog.findFirst({
            where: { actorId, action: "REVEAL_HIDDEN_TEST" },
        })
        assert.ok(row)
        assert.equal(row.targetId, "ckTest")
        assert.deepEqual(row.metadata, { dialect: "DUCKDB" })
    })
})
