import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    computeHiddenFingerprint,
    validateHiddenDataset,
} from "../lib/contest-hidden-validator"

const PREFIX = "contest-hidden-validator-test-"

let pool: pg.Pool
let prisma: PrismaClient
let problemId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for hidden validator tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (x INT);" },
    })
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 50_000,
            slug: `${PREFIX}problem`,
            title: `${PREFIX}Problem`,
            description: "x",
            schemaDescription: "test schema",
            difficulty: "EASY",
            schemaId: schema.id,
            status: "DRAFT",
            dialects: ["DUCKDB"],
            expectedOutput: "[]",
            expectedOutputs: { DUCKDB: "[]" },
            solutionSql: "SELECT x FROM t ORDER BY x",
            solutions: { DUCKDB: "SELECT x FROM t ORDER BY x" },
        },
    })
    problemId = problem.id
})

after(async () => {
    await cleanup()
    await prisma?.$disconnect()
    await pool?.end().catch(() => {})
})

async function cleanup() {
    await prisma?.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma?.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
}

describe("computeHiddenFingerprint", () => {
    it("is stable across object key order", () => {
        const a = computeHiddenFingerprint({
            hiddenSchemas: { DUCKDB: "CREATE TABLE t(x INT);" },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 1, y: 2 }] },
            solutions: { DUCKDB: "SELECT x FROM t" },
            dialects: ["DUCKDB"],
            ordered: false,
        })
        const b = computeHiddenFingerprint({
            hiddenSchemas: { DUCKDB: "CREATE TABLE t(x INT);" },
            hiddenExpectedOutputs: { DUCKDB: [{ y: 2, x: 1 }] },
            solutions: { DUCKDB: "SELECT x FROM t" },
            dialects: ["DUCKDB"],
            ordered: false,
        })
        assert.equal(a, b)
    })
})

describe("validateHiddenDataset", () => {
    it("accepts hidden data when the canonical solution matches expected rows", async () => {
        const result = await validateHiddenDataset({
            problemId,
            hiddenSchemas: {
                DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1), (2);",
            },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 1 }, { x: 2 }] },
        })

        assert.equal(result.ok, true)
        if (result.ok) {
            assert.equal(result.dialects[0], "DUCKDB")
            assert.ok(result.schemaHashes.DUCKDB)
            assert.ok(result.fingerprint)
        }
    })

    it("rejects hidden data when expected rows do not match", async () => {
        const result = await validateHiddenDataset({
            problemId,
            hiddenSchemas: {
                DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1), (2);",
            },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 999 }] },
        })

        assert.equal(result.ok, false)
        if (!result.ok) {
            assert.match(result.errors[0]?.reason ?? "", /WRONG_ANSWER/)
        }
    })
})
