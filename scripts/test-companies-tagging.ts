// Integration tests for V18 companies tagging.
// Runs against the local dev DB; seeds with a unique prefix and cleans up after.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-companies-tagging.ts

import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    getProblems,
    getProblemsByTag,
    getPublicTags,
    getPublicTagsByKind,
} from "../actions/problems"
import { TagCreateInput } from "../lib/admin-validation"

const PREFIX = "cotest-"
const TOPIC_SLUG = `${PREFIX}window-functions`
const GHOST_TOPIC_SLUG = `${PREFIX}ghost-topic`
const COMPANY_A_SLUG = `${PREFIX}stripe`
const COMPANY_B_SLUG = `${PREFIX}airbnb`
const COMPANY_C_SLUG = `${PREFIX}coinbase`

let pool: pg.Pool
let prisma: PrismaClient
let schemaId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for companies tagging tests")
    }

    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    prisma = new PrismaClient({ adapter })

    await cleanup()

    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}schema`,
            sql: "CREATE TABLE t (id INTEGER);",
        },
    })
    schemaId = schema.id

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    let next = (max._max.number ?? 0) + 10_000

    await prisma.tag.create({
        data: { name: `${PREFIX}Window Functions`, slug: TOPIC_SLUG },
    })
    await prisma.tag.create({
        data: {
            name: `${PREFIX}Ghost Topic`,
            slug: GHOST_TOPIC_SLUG,
        },
    })
    await prisma.tag.create({
        data: {
            name: `${PREFIX}Stripe`,
            slug: COMPANY_A_SLUG,
            kind: "COMPANY",
        },
    })
    await prisma.tag.create({
        data: {
            name: `${PREFIX}Airbnb`,
            slug: COMPANY_B_SLUG,
            kind: "COMPANY",
        },
    })
    await prisma.tag.create({
        data: {
            name: `${PREFIX}Coinbase`,
            slug: COMPANY_C_SLUG,
            kind: "COMPANY",
        },
    })

    const baseData = {
        description: "test description",
        schemaDescription: "test schema description",
        schemaId,
        expectedOutput: "[]",
        difficulty: "EASY" as const,
        status: "PUBLISHED" as const,
        dialects: ["DUCKDB" as const],
    }

    for (let i = 0; i < 2; i++) {
        await prisma.sQLProblem.create({
            data: {
                ...baseData,
                number: next++,
                slug: `${PREFIX}topic-${i}`,
                title: `${PREFIX}Topic ${i}`,
                tags: { connect: [{ slug: TOPIC_SLUG }] },
            },
        })
    }

    for (let i = 0; i < 3; i++) {
        await prisma.sQLProblem.create({
            data: {
                ...baseData,
                number: next++,
                slug: `${PREFIX}stripe-${i}`,
                title: `${PREFIX}Stripe ${i}`,
                tags: {
                    connect: [{ slug: COMPANY_A_SLUG }, { slug: TOPIC_SLUG }],
                },
            },
        })
    }

    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}airbnb-published`,
            title: `${PREFIX}Airbnb Published`,
            tags: { connect: [{ slug: COMPANY_B_SLUG }] },
        },
    })
    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}coinbase-published`,
            title: `${PREFIX}Coinbase Published`,
            tags: { connect: [{ slug: COMPANY_C_SLUG }] },
        },
    })
    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}ghost-draft`,
            title: `${PREFIX}Ghost Draft`,
            status: "DRAFT",
            tags: { connect: [{ slug: GHOST_TOPIC_SLUG }] },
        },
    })
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end().catch(() => {})
})

async function cleanup() {
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.tag.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
}

describe("Tag.kind", () => {
    it("defaults tags without kind to TOPIC", async () => {
        const tag = await prisma.tag.findUniqueOrThrow({
            where: { slug: TOPIC_SLUG },
            select: { kind: true },
        })

        assert.equal(tag.kind, "TOPIC")
    })

    it("validates kind in admin input", () => {
        const parsed = TagCreateInput.parse({
            name: `${PREFIX}Default Topic`,
            slug: `${PREFIX}default-topic`,
        })
        assert.equal(parsed.kind, "TOPIC")

        const invalid = TagCreateInput.safeParse({
            name: `${PREFIX}Movie`,
            slug: `${PREFIX}movie`,
            kind: "MOVIE",
        })
        assert.equal(invalid.success, false)
    })
})

describe("company-aware public tag actions", () => {
    it("returns kind on public tags", async () => {
        const tags = await getPublicTags()
        const topic = tags.find((t) => t.slug === TOPIC_SLUG)
        const company = tags.find((t) => t.slug === COMPANY_A_SLUG)

        assert.equal(topic?.kind, "TOPIC")
        assert.equal(company?.kind, "COMPANY")
    })

    it("filters companies and keeps count-desc/name-asc ordering", async () => {
        const companies = (await getPublicTagsByKind("COMPANY")).filter((t) =>
            t.slug.startsWith(PREFIX),
        )

        assert.deepEqual(
            companies.map((t) => [t.slug, t.problemCount]),
            [
                [COMPANY_A_SLUG, 3],
                [COMPANY_B_SLUG, 1],
                [COMPANY_C_SLUG, 1],
            ],
        )
        assert.equal(
            companies.every((t) => t.kind === "COMPANY"),
            true,
        )
    })

    it("filters topics symmetrically and still excludes ghost tags", async () => {
        const topics = (await getPublicTagsByKind("TOPIC")).filter((t) =>
            t.slug.startsWith(PREFIX),
        )

        assert.deepEqual(
            topics.map((t) => t.slug),
            [TOPIC_SLUG],
        )
        assert.equal(topics[0]?.kind, "TOPIC")
    })

    it("returns company tag kind and problem tag kind from tag detail", async () => {
        const result = await getProblemsByTag(COMPANY_A_SLUG)

        assert.equal(result.tag?.kind, "COMPANY")
        assert.equal(result.problems.length, 3)
        assert.equal(
            result.problems[0].tags.some(
                (t) => t.slug === COMPANY_A_SLUG && t.kind === "COMPANY",
            ),
            true,
        )
    })

    it("returns tag kind in the public problem listing", async () => {
        const result = await getProblems()
        assert.equal(result.success, true)

        const problem = result.data.find((p) => p.slug === `${PREFIX}stripe-0`)
        assert.equal(
            problem?.tags.some(
                (t) => t.slug === COMPANY_A_SLUG && t.kind === "COMPANY",
            ),
            true,
        )
    })
})
