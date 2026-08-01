// Integration tests for the curriculum read layer and progress writes.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-curriculum-actions.ts

import "dotenv/config"
import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import { getTrackCurriculum } from "../actions/curriculum"

const PREFIX = "curricread-"
const TRACK_SLUG = `${PREFIX}track`

let pool: pg.Pool
let prisma: PrismaClient
let userId: string
let lessonAId: string
let problemAId: string

async function cleanup() {
    await prisma.submission.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await prisma.lessonProgress.deleteMany({ where: { user: { email: { startsWith: PREFIX } } } })
    await prisma.lessonCheckpoint.deleteMany({ where: { article: { slug: { startsWith: PREFIX } } } })
    await prisma.moduleLesson.deleteMany({ where: { article: { slug: { startsWith: PREFIX } } } })
    await prisma.module.deleteMany({ where: { track: { slug: { startsWith: PREFIX } } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

before(async () => {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required")
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (id INTEGER);" },
    })
    const author = await prisma.user.create({
        data: { email: `${PREFIX}author@example.com`, name: "A" },
    })
    const learner = await prisma.user.create({
        data: { email: `${PREFIX}learner@example.com`, name: "L" },
    })
    userId = learner.id
    const topic = await prisma.topic.create({
        data: { name: `${PREFIX}Topic`, slug: `${PREFIX}topic` },
    })
    const track = await prisma.track.create({
        data: { slug: TRACK_SLUG, name: "T", summary: "s", description: "d" },
    })

    const m1 = await prisma.module.create({
        data: { trackId: track.id, slug: "m1", name: "M1", description: "d", position: 0 },
    })
    const m2 = await prisma.module.create({
        data: { trackId: track.id, slug: "m2", name: "M2", description: "d", position: 1 },
    })

    const article = async (slug: string) =>
        prisma.article.create({
            data: {
                title: slug,
                slug: `${PREFIX}${slug}`,
                content: "c",
                status: "PUBLISHED",
                topicId: topic.id,
                authorId: author.id,
            },
            select: { id: true },
        })

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    let n = (max._max.number ?? 0) + 1
    const problem = async (slug: string) =>
        prisma.sQLProblem.create({
            data: {
                number: n++,
                title: slug,
                slug: `${PREFIX}${slug}`,
                difficulty: "EASY",
                status: "PUBLISHED",
                description: "d",
                schemaDescription: "s",
                schemaId: schema.id,
                expectedOutput: "[]",
                dialects: ["DUCKDB"],
            },
            select: { id: true },
        })

    // M1: one lesson (read) with one checkpoint (solved) → 100%
    const la = await article("lesson-a")
    lessonAId = la.id
    const pa = await problem("problem-a")
    problemAId = pa.id
    await prisma.moduleLesson.create({
        data: { moduleId: m1.id, articleId: la.id, position: 0 },
    })
    await prisma.lessonCheckpoint.create({
        data: { articleId: la.id, problemId: pa.id, position: 0 },
    })
    await prisma.lessonProgress.create({
        data: { userId, articleId: la.id, percent: 100, completedAt: new Date() },
    })
    await prisma.submission.create({
        data: { userId, problemId: pa.id, status: "ACCEPTED", code: "select 1" },
    })

    // M2: one lesson (unread), no checkpoints → 0%
    const lb = await article("lesson-b")
    await prisma.moduleLesson.create({
        data: { moduleId: m2.id, articleId: lb.id, position: 0 },
    })
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end()
})

describe("getTrackCurriculum", () => {
    it("returns null for an unknown track", async () => {
        assert.equal(await getTrackCurriculum("no-such-track", userId), null)
    })

    it("returns modules in position order", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        assert.deepEqual(c?.modules.map((m) => m.slug), ["m1", "m2"])
    })

    it("marks a read lesson completed and a solved checkpoint solved", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        const m1 = c!.modules[0]
        assert.equal(m1.lessons[0].completed, true)
        assert.equal(m1.lessons[0].checkpoints[0].solved, true)
        assert.equal(m1.rollup.percent, 100)
    })

    it("leaves the second module at 0%", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        assert.equal(c!.modules[1].rollup.percent, 0)
    })

    it("unlocks module 2 because module 1 is complete", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        assert.equal(c!.modules[0].unlocked, true)
        assert.equal(c!.modules[1].unlocked, true)
    })

    it("rolls the track up from the totals", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, userId)
        // 1 of 2 lessons + 1 of 1 problems = 2 of 3
        assert.equal(c!.rollup.percent, 67)
    })

    it("reports everything incomplete for an anonymous viewer", async () => {
        const c = await getTrackCurriculum(TRACK_SLUG, null)
        assert.equal(c!.rollup.percent, 0)
        assert.equal(c!.modules[0].lessons[0].completed, false)
        assert.equal(c!.modules[0].lessons[0].checkpoints[0].solved, false)
        // Module 1 is not complete for an anonymous viewer, so module 2 locks.
        assert.equal(c!.modules[1].unlocked, false)
    })
})
