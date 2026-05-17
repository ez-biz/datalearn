// Integration tests for V9 study plan tracks.
// Runs against the local dev DB; seeds with a unique prefix and cleans up after.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-tracks.ts

import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    getPublishedTracks,
    getTrackBySlug,
    getTrackProgress,
} from "../actions/tracks"
import {
    addTrackItemToTrack,
    reorderTrackItems,
} from "../lib/admin-tracks"
import {
    TrackCreateInput,
    TrackItemAddInput,
    TrackReorderInput,
} from "../lib/admin-validation"
import { getTrackProgressForUser } from "../lib/tracks"

const PREFIX = "tracktest-"
const PUBLISHED_SLUG = `${PREFIX}published`
const NEWER_PUBLISHED_SLUG = `${PREFIX}newer`
const DRAFT_SLUG = `${PREFIX}draft`
const ARCHIVED_SLUG = `${PREFIX}archived`
const USER_EMAIL = `${PREFIX}learner@example.com`

let pool: pg.Pool
let prisma: PrismaClient
let schemaId: string
let publishedTrackId: string
let firstItemId: string
let secondItemId: string
let thirdItemId: string
let firstProblemId: string
let secondProblemId: string
let thirdProblemId: string
let userId: string

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for tracks tests")
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
    let next = (max._max.number ?? 0) + 30_000

    const baseProblem = {
        description: "test description",
        schemaDescription: "test schema description",
        schemaId,
        expectedOutput: "[]",
        status: "PUBLISHED" as const,
        dialects: ["DUCKDB" as const],
    }

    const first = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-1`,
            title: `${PREFIX}Problem 1`,
            difficulty: "EASY",
        },
    })
    const second = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-2`,
            title: `${PREFIX}Problem 2`,
            difficulty: "MEDIUM",
        },
    })
    const third = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-3`,
            title: `${PREFIX}Problem 3`,
            difficulty: "HARD",
        },
    })
    const fourth = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-4`,
            title: `${PREFIX}Problem 4`,
            difficulty: "EASY",
        },
    })

    firstProblemId = first.id
    secondProblemId = second.id
    thirdProblemId = third.id

    const published = await prisma.track.create({
        data: {
            slug: PUBLISHED_SLUG,
            name: `${PREFIX}Published Track`,
            summary: "Published track summary",
            description: "Published track description",
            difficulty: "MIXED",
            status: "PUBLISHED",
            estimatedMinutes: 90,
            createdAt: new Date("2026-05-01T00:00:00.000Z"),
        },
    })
    publishedTrackId = published.id

    const secondItem = await prisma.trackItem.create({
        data: {
            trackId: published.id,
            problemId: second.id,
            position: 1,
        },
    })
    const firstItem = await prisma.trackItem.create({
        data: {
            trackId: published.id,
            problemId: first.id,
            position: 0,
        },
    })
    const thirdItem = await prisma.trackItem.create({
        data: {
            trackId: published.id,
            problemId: third.id,
            position: 2,
        },
    })
    firstItemId = firstItem.id
    secondItemId = secondItem.id
    thirdItemId = thirdItem.id

    await prisma.track.create({
        data: {
            slug: NEWER_PUBLISHED_SLUG,
            name: `${PREFIX}Newer Published Track`,
            summary: "Newer track summary",
            description: "Newer track description",
            status: "PUBLISHED",
            createdAt: new Date("2026-05-02T00:00:00.000Z"),
            items: {
                create: [{ problemId: fourth.id, position: 0 }],
            },
        },
    })

    await prisma.track.create({
        data: {
            slug: DRAFT_SLUG,
            name: `${PREFIX}Draft Track`,
            summary: "Draft track summary",
            description: "Draft track description",
            status: "DRAFT",
            items: {
                create: [{ problemId: fourth.id, position: 0 }],
            },
        },
    })

    await prisma.track.create({
        data: {
            slug: ARCHIVED_SLUG,
            name: `${PREFIX}Archived Track`,
            summary: "Archived track summary",
            description: "Archived track description",
            status: "ARCHIVED",
        },
    })

    const user = await prisma.user.create({
        data: {
            email: USER_EMAIL,
            name: `${PREFIX}Learner`,
        },
    })
    userId = user.id

    await prisma.submission.create({
        data: {
            userId,
            problemId: first.id,
            status: "ACCEPTED",
            code: "SELECT 1;",
        },
    })
    await prisma.submission.create({
        data: {
            userId,
            problemId: first.id,
            status: "ACCEPTED",
            code: "SELECT 1;",
        },
    })
    await prisma.submission.create({
        data: {
            userId,
            problemId: second.id,
            status: "WRONG_ANSWER",
            code: "SELECT 2;",
        },
    })
    await prisma.submission.create({
        data: {
            userId,
            problemId: third.id,
            status: "ACCEPTED",
            code: "SELECT 3;",
        },
    })
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end().catch(() => {})
})

async function cleanup() {
    await prisma.user.deleteMany({
        where: { email: { startsWith: PREFIX } },
    })
    await prisma.track.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
}

describe("getPublishedTracks", () => {
    it("returns only PUBLISHED tracks ordered by newest first", async () => {
        const tracks = (await getPublishedTracks()).filter((track) =>
            track.slug.startsWith(PREFIX),
        )

        assert.deepEqual(
            tracks.map((track) => track.slug),
            [NEWER_PUBLISHED_SLUG, PUBLISHED_SLUG],
        )
        assert.equal(
            tracks.every((track) => track.status === "PUBLISHED"),
            true,
        )
    })

    it("returns item counts and editorial metadata", async () => {
        const tracks = await getPublishedTracks()
        const track = tracks.find((row) => row.slug === PUBLISHED_SLUG)

        assert.equal(track?.name, `${PREFIX}Published Track`)
        assert.equal(track?.summary, "Published track summary")
        assert.equal(track?.difficulty, "MIXED")
        assert.equal(track?.estimatedMinutes, 90)
        assert.equal(track?.itemCount, 3)
    })
})

describe("getTrackBySlug", () => {
    it("returns ordered items by position ascending", async () => {
        const track = await getTrackBySlug(PUBLISHED_SLUG)

        assert.equal(track?.slug, PUBLISHED_SLUG)
        assert.deepEqual(
            track?.items.map((item) => item.id),
            [firstItemId, secondItemId, thirdItemId],
        )
        assert.deepEqual(
            track?.items.map((item) => item.problem.id),
            [firstProblemId, secondProblemId, thirdProblemId],
        )
    })

    it("returns null for unknown, DRAFT, and ARCHIVED tracks", async () => {
        assert.equal(await getTrackBySlug(`${PREFIX}missing`), null)
        assert.equal(await getTrackBySlug(DRAFT_SLUG), null)
        assert.equal(await getTrackBySlug(ARCHIVED_SLUG), null)
    })
})

describe("track progress", () => {
    it("returns zero progress and the first item for anonymous learners", async () => {
        const progress = await getTrackProgress(publishedTrackId)

        assert.deepEqual(progress, {
            completedCount: 0,
            totalCount: 3,
            nextItemId: firstItemId,
        })
    })

    it("counts distinct accepted problems and picks the first unsolved item", async () => {
        const progress = await getTrackProgressForUser(publishedTrackId, userId)

        assert.deepEqual(progress, {
            completedCount: 2,
            totalCount: 3,
            nextItemId: secondItemId,
        })
    })
})

describe("track admin validation", () => {
    it("defaults create input to a draft medium track", () => {
        const parsed = TrackCreateInput.parse({
            name: `${PREFIX}Validated`,
            slug: `${PREFIX}validated`,
            summary: "Validated summary",
            description: "Validated description",
        })

        assert.equal(parsed.difficulty, "MEDIUM")
        assert.equal(parsed.status, "DRAFT")
        assert.equal(parsed.estimatedMinutes, 60)
    })

    it("rejects invalid track item and reorder payloads", () => {
        assert.equal(
            TrackItemAddInput.safeParse({ problemSlug: "Not Valid" }).success,
            false,
        )
        assert.equal(
            TrackReorderInput.safeParse({ itemIds: [] }).success,
            false,
        )
    })
})

describe("track admin item operations", () => {
    it("rejects adding the same problem twice", async () => {
        const result = await addTrackItemToTrack(PUBLISHED_SLUG, {
            problemSlug: `${PREFIX}problem-1`,
        })

        assert.deepEqual(result, {
            ok: false,
            status: 409,
            error: "Problem already exists in this track.",
        })
    })

    it("rejects partial reorder payloads without changing positions", async () => {
        const result = await reorderTrackItems(PUBLISHED_SLUG, [
            firstItemId,
            secondItemId,
        ])

        assert.deepEqual(result, {
            ok: false,
            status: 400,
            error: "Reorder payload must include every current track item exactly once.",
        })

        const items = await prisma.trackItem.findMany({
            where: { trackId: publishedTrackId },
            orderBy: { position: "asc" },
            select: { id: true },
        })
        assert.deepEqual(
            items.map((item) => item.id),
            [firstItemId, secondItemId, thirdItemId],
        )
    })

    it("rewrites positions atomically for a complete reorder", async () => {
        const result = await reorderTrackItems(PUBLISHED_SLUG, [
            thirdItemId,
            secondItemId,
            firstItemId,
        ])

        assert.deepEqual(result, { ok: true })

        const items = await prisma.trackItem.findMany({
            where: { trackId: publishedTrackId },
            orderBy: { position: "asc" },
            select: { id: true, position: true },
        })
        assert.deepEqual(
            items.map((item) => [item.id, item.position]),
            [
                [thirdItemId, 0],
                [secondItemId, 1],
                [firstItemId, 2],
            ],
        )
    })
})
