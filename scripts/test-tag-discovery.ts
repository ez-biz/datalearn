// Integration tests for actions/problems.ts tag-discovery additions.
// Runs against the local dev DB; seeds with a unique prefix and cleans up after.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-tag-discovery.ts

import "dotenv/config"
import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    getProblems,
    getProblemsByTag,
    getPublicTags,
} from "../actions/problems"

// All test data is namespaced under this prefix so we can clean up cleanly.
const PREFIX = "tagtest-"
const TAG_A_SLUG = `${PREFIX}alpha`
const TAG_B_SLUG = `${PREFIX}beta`
const TAG_C_SLUG = `${PREFIX}gamma`
const TAG_GHOST_SLUG = `${PREFIX}ghost`

let pool: pg.Pool
let prisma: PrismaClient
let schemaId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for tag-discovery tests")
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    const adapter = new PrismaPg(pool)
    prisma = new PrismaClient({ adapter })

    await cleanup()

    // Shared SqlSchema for all test problems.
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}schema`,
            sql: "CREATE TABLE t (id INTEGER);",
        },
    })
    schemaId = schema.id

    // Get max number once and mint sequential test numbers so we don't
    // clash with real data. We'll use very high numbers (max + 1000+).
    const max = await prisma.sQLProblem.aggregate({
        _max: { number: true },
    })
    let next = (max._max.number ?? 0) + 1000

    // Tags: alpha (3 PUBLISHED), beta (1 PUBLISHED + 1 DRAFT), gamma (1 PUBLISHED),
    //       ghost (only DRAFT)
    await prisma.tag.create({
        data: { name: `${PREFIX}Alpha`, slug: TAG_A_SLUG },
    })
    await prisma.tag.create({
        data: { name: `${PREFIX}Beta`, slug: TAG_B_SLUG },
    })
    await prisma.tag.create({
        data: { name: `${PREFIX}Gamma`, slug: TAG_C_SLUG },
    })
    await prisma.tag.create({
        data: { name: `${PREFIX}Ghost`, slug: TAG_GHOST_SLUG },
    })

    const baseData = {
        description: "test description",
        schemaDescription: "test schema description",
        schemaId,
        expectedOutput: "[]",
    }

    // Alpha: 3 PUBLISHED problems
    for (let i = 0; i < 3; i++) {
        await prisma.sQLProblem.create({
            data: {
                ...baseData,
                number: next++,
                slug: `${PREFIX}alpha-${i}`,
                title: `${PREFIX}Alpha ${i}`,
                difficulty: "EASY",
                status: "PUBLISHED",
                dialects: ["DUCKDB"],
                tags: { connect: [{ slug: TAG_A_SLUG }] },
            },
        })
    }

    // Beta: 1 PUBLISHED + 1 DRAFT
    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}beta-pub`,
            title: `${PREFIX}Beta Published`,
            difficulty: "MEDIUM",
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
            tags: { connect: [{ slug: TAG_B_SLUG }] },
        },
    })
    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}beta-draft`,
            title: `${PREFIX}Beta Draft`,
            difficulty: "MEDIUM",
            status: "DRAFT",
            dialects: ["DUCKDB"],
            tags: { connect: [{ slug: TAG_B_SLUG }] },
        },
    })

    // Gamma: 1 PUBLISHED (used to verify count-desc / name-asc ordering)
    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}gamma-pub`,
            title: `${PREFIX}Gamma Published`,
            difficulty: "HARD",
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
            tags: { connect: [{ slug: TAG_C_SLUG }] },
        },
    })

    // Ghost: only DRAFT — should not appear in index or by-tag lookup
    await prisma.sQLProblem.create({
        data: {
            ...baseData,
            number: next++,
            slug: `${PREFIX}ghost-draft`,
            title: `${PREFIX}Ghost Draft`,
            difficulty: "EASY",
            status: "DRAFT",
            dialects: ["DUCKDB"],
            tags: { connect: [{ slug: TAG_GHOST_SLUG }] },
        },
    })
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end().catch(() => {})
})

async function cleanup() {
    // Delete in FK-safe order: problems first (cascades the implicit join),
    // then tags, then schema.
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

describe("getPublicTags", () => {
    it("returns only tags with at least one PUBLISHED problem", async () => {
        const tags = await getPublicTags()
        const slugs = tags.map((t) => t.slug)
        // The ghost tag has only DRAFT problems — should not appear.
        assert.equal(
            slugs.includes(TAG_GHOST_SLUG),
            false,
            "ghost tag with only DRAFT problems should be excluded"
        )
        assert.equal(slugs.includes(TAG_A_SLUG), true)
        assert.equal(slugs.includes(TAG_B_SLUG), true)
        assert.equal(slugs.includes(TAG_C_SLUG), true)
    })

    it("counts PUBLISHED problems correctly (excludes DRAFT)", async () => {
        const tags = await getPublicTags()
        const alpha = tags.find((t) => t.slug === TAG_A_SLUG)
        const beta = tags.find((t) => t.slug === TAG_B_SLUG)
        assert.equal(alpha?.problemCount, 3, "alpha should have 3 published")
        // Beta has 1 PUBLISHED + 1 DRAFT — count must be 1, not 2.
        assert.equal(beta?.problemCount, 1, "beta count must exclude DRAFT")
    })

    it("sorts by problemCount desc, then name asc", async () => {
        const tags = await getPublicTags()
        // Filter down to our test tags so we can assert order deterministically.
        const ours = tags.filter((t) => t.slug.startsWith(PREFIX))
        const counts = ours.map((t) => t.problemCount)
        // Strictly non-increasing
        for (let i = 1; i < counts.length; i++) {
            assert.ok(
                counts[i - 1] >= counts[i],
                `expected non-increasing count, got ${counts.join(",")}`
            )
        }
        // Beta(1) and Gamma(1) both have count 1 — Beta < Gamma alphabetically.
        const betaIdx = ours.findIndex((t) => t.slug === TAG_B_SLUG)
        const gammaIdx = ours.findIndex((t) => t.slug === TAG_C_SLUG)
        assert.ok(
            betaIdx < gammaIdx,
            "ties on count should break by name ascending"
        )
    })
})

describe("getProblemsByTag", () => {
    it("returns null tag for unknown slug so caller can 404", async () => {
        const result = await getProblemsByTag(`${PREFIX}does-not-exist`)
        assert.equal(result.tag, null)
        assert.deepEqual(result.problems, [])
    })

    it("excludes DRAFT problems (PUBLISHED gate)", async () => {
        const result = await getProblemsByTag(TAG_B_SLUG)
        assert.ok(result.tag, "tag should exist")
        // Beta has 1 PUBLISHED + 1 DRAFT — only the published one comes back.
        assert.equal(result.problems.length, 1)
        assert.equal(result.problems[0].slug, `${PREFIX}beta-pub`)
    })

    it("returns the tag metadata", async () => {
        const result = await getProblemsByTag(TAG_A_SLUG)
        assert.equal(result.tag?.slug, TAG_A_SLUG)
        assert.equal(result.tag?.name, `${PREFIX}Alpha`)
    })

    it("preserves number-asc ordering inside the tag", async () => {
        const result = await getProblemsByTag(TAG_A_SLUG)
        const numbers = result.problems.map((p) => p.number)
        for (let i = 1; i < numbers.length; i++) {
            assert.ok(
                numbers[i - 1] < numbers[i],
                `expected ascending numbers, got ${numbers.join(",")}`
            )
        }
    })

    it("returns null tag for ghost slug (existing tag with no PUBLISHED problems)", async () => {
        // The tag exists in the DB but has zero PUBLISHED problems.
        // Treat that as 404-equivalent so we don't render an empty tag page.
        const result = await getProblemsByTag(TAG_GHOST_SLUG)
        assert.equal(result.tag, null)
        assert.deepEqual(result.problems, [])
    })
})

describe("getProblems projection includes tags", () => {
    it("returns tags array on each public problem", async () => {
        const result = await getProblems()
        assert.equal(result.success, true)
        // Find our alpha problems in the listing.
        const alpha0 = result.data.find(
            (p) => p.slug === `${PREFIX}alpha-0`
        )
        assert.ok(alpha0, "alpha-0 should appear in PUBLISHED listing")
        assert.ok(Array.isArray(alpha0.tags), "tags must be an array")
        assert.equal(alpha0.tags.length, 1)
        assert.equal(alpha0.tags[0].slug, TAG_A_SLUG)
        assert.equal(alpha0.tags[0].name, `${PREFIX}Alpha`)
    })
})
