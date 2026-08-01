// Integration tests for curriculum module mutations.
// Runs against the local dev DB; seeds with a unique prefix and cleans up.
//
// Run: DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
//      node --import tsx --test scripts/test-curriculum-admin.ts

import "dotenv/config"
import { after, before, beforeEach, describe, it } from "node:test"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"
import {
    addCheckpoint,
    addLessonToModule,
    createModule,
    deleteModule,
    isUniqueViolationOn,
    mapWriteFailure,
    removeCheckpoint,
    removeLessonFromModule,
    reorderCheckpoints,
    reorderModuleLessons,
    reorderModules,
    updateModule,
} from "../lib/admin-curriculum"

const PREFIX = "curriculumtest-"
const TRACK_SLUG = `${PREFIX}track`

let pool: pg.Pool
let prisma: PrismaClient
let trackId: string

async function cleanup() {
    await prisma.lessonCheckpoint.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.moduleLesson.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for curriculum tests")
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (id INTEGER);" },
    })
    schemaId = schema.id
    const author = await prisma.user.create({
        data: { email: `${PREFIX}author@example.com`, name: "Author" },
    })
    authorId = author.id
    const topic = await prisma.topic.create({
        data: { name: `${PREFIX}Topic`, slug: `${PREFIX}topic` },
    })
    topicId = topic.id
})

beforeEach(async () => {
    await prisma.lessonCheckpoint.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.moduleLesson.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: TRACK_SLUG } })
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    const track = await prisma.track.create({
        data: {
            slug: TRACK_SLUG,
            name: `${PREFIX}Track`,
            summary: "s",
            description: "d",
        },
    })
    trackId = track.id
})

after(async () => {
    await cleanup()
    await prisma.$disconnect()
    await pool.end()
})

async function slugsInOrder(): Promise<string[]> {
    const rows = await prisma.module.findMany({
        where: { trackId },
        orderBy: { position: "asc" },
        select: { slug: true },
    })
    return rows.map((r) => r.slug)
}

let schemaId: string
let authorId: string
let topicId: string

async function makeArticle(slug: string): Promise<string> {
    const a = await prisma.article.create({
        data: {
            title: slug,
            slug: `${PREFIX}${slug}`,
            content: "body",
            status: "PUBLISHED",
            topicId,
            authorId,
        },
        select: { id: true },
    })
    return a.id
}

async function makeProblem(slug: string): Promise<string> {
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const p = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 1,
            title: slug,
            slug: `${PREFIX}${slug}`,
            difficulty: "EASY",
            status: "PUBLISHED",
            description: "d",
            schemaDescription: "s",
            schemaId,
            expectedOutput: "[]",
            dialects: ["DUCKDB"],
        },
        select: { id: true },
    })
    return p.id
}

async function lessonIdsInOrder(moduleSlug: string): Promise<string[]> {
    const rows = await prisma.moduleLesson.findMany({
        where: { module: { trackId, slug: moduleSlug } },
        orderBy: { position: "asc" },
        select: { articleId: true },
    })
    return rows.map((r) => r.articleId)
}

async function checkpointIdsInOrder(articleSlug: string): Promise<string[]> {
    const rows = await prisma.lessonCheckpoint.findMany({
        where: { article: { slug: `${PREFIX}${articleSlug}` } },
        orderBy: { position: "asc" },
        select: { problemId: true },
    })
    return rows.map((r) => r.problemId)
}

describe("createModule", () => {
    it("appends when no position is given", async () => {
        await createModule(TRACK_SLUG, { name: "Foundations", description: "d" })
        await createModule(TRACK_SLUG, { name: "Joins", description: "d" })
        assert.deepEqual(await slugsInOrder(), ["foundations", "joins"])
    })

    it("derives the slug from the name", async () => {
        const r = await createModule(TRACK_SLUG, {
            name: "Window Functions",
            description: "d",
        })
        assert.equal(r.ok, true)
        assert.equal(r.ok && r.data.slug, "window-functions")
    })

    it("inserts at an explicit position and shifts the rest down", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "C", description: "d" })
        await createModule(TRACK_SLUG, {
            name: "B",
            description: "d",
            position: 1,
        })
        assert.deepEqual(await slugsInOrder(), ["a", "b", "c"])
    })

    it("404s for an unknown track", async () => {
        const r = await createModule("no-such-track", {
            name: "A",
            description: "d",
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })

    it("409s on a duplicate slug within the track", async () => {
        await createModule(TRACK_SLUG, { name: "Joins", description: "d" })
        const r = await createModule(TRACK_SLUG, { name: "Joins", description: "d" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })
})

describe("updateModule", () => {
    it("renames without touching position", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const r = await updateModule(TRACK_SLUG, "a", { name: "Alpha" })
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["a", "b"])
        const row = await prisma.module.findFirst({ where: { trackId, slug: "a" } })
        assert.equal(row?.name, "Alpha")
    })

    it("changes the slug when asked", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        const r = await updateModule(TRACK_SLUG, "a", { slug: "alpha" })
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["alpha"])
    })

    it("404s for an unknown module", async () => {
        const r = await updateModule(TRACK_SLUG, "nope", { name: "x" })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })
})

describe("deleteModule", () => {
    it("removes the module and closes the position gap", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        await createModule(TRACK_SLUG, { name: "C", description: "d" })
        const r = await deleteModule(TRACK_SLUG, "b")
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["a", "c"])
        const rows = await prisma.module.findMany({
            where: { trackId },
            orderBy: { position: "asc" },
            select: { position: true },
        })
        assert.deepEqual(rows.map((r) => r.position), [0, 1])
    })

    it("404s for an unknown module", async () => {
        const r = await deleteModule(TRACK_SLUG, "nope")
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })
})

describe("reorderModules", () => {
    it("applies the requested order", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        await createModule(TRACK_SLUG, { name: "C", description: "d" })
        const r = await reorderModules(TRACK_SLUG, ["c", "a", "b"])
        assert.equal(r.ok, true)
        assert.deepEqual(await slugsInOrder(), ["c", "a", "b"])
    })

    it("400s when the payload omits a module", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const r = await reorderModules(TRACK_SLUG, ["a"])
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 400)
    })

    it("400s on a duplicate entry", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const r = await reorderModules(TRACK_SLUG, ["a", "a"])
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 400)
    })

    it("does not change Track.status", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await reorderModules(TRACK_SLUG, ["a"])
        const track = await prisma.track.findUnique({ where: { slug: TRACK_SLUG } })
        assert.equal(track?.status, "DRAFT")
    })

    it("returns a well-formed result, never an unhandled throw, when a module vanishes mid-reorder", async () => {
        await createModule(TRACK_SLUG, { name: "A", description: "d" })
        await createModule(TRACK_SLUG, { name: "B", description: "d" })
        const b = await prisma.module.findFirst({ where: { trackId, slug: "b" } })
        const reorderPromise = reorderModules(TRACK_SLUG, ["b", "a"])
        await prisma.module.delete({ where: { id: b!.id } })
        const r = await reorderPromise
        // The delete usually wins (400 from the permutation check) but may lose
        // (409 from the transaction catch). Both are correct; a throw is not.
        assert.equal(typeof r.ok, "boolean")
        if (!r.ok) assert.ok(r.status === 400 || r.status === 409)
    })
})

describe("isUniqueViolationOn", () => {
    // Hand-built rather than a real PrismaClientKnownRequestError: if the
    // driver's error shape changes these mocks will not drift with it. The
    // end-to-end net is "409s on a duplicate slug within the track" above,
    // which provokes a real P2002 through @prisma/adapter-pg.
    // The shape @prisma/adapter-pg actually produces — verified against the
    // local database. `meta.target` is undefined and trackId arrives quoted.
    const driverShape = {
        code: "P2002",
        meta: {
            driverAdapterError: {
                cause: { constraint: { fields: ['"trackId"', "slug"] } },
            },
        },
    }

    it("reads the driver-adapter shape that this project actually produces", () => {
        assert.equal(isUniqueViolationOn(driverShape, "slug"), true)
    })

    it("strips the quoting the driver applies to some field names", () => {
        assert.equal(isUniqueViolationOn(driverShape, "trackId"), true)
    })

    it("does not match a field absent from the constraint", () => {
        assert.equal(isUniqueViolationOn(driverShape, "position"), false)
    })

    it("still reads a plain meta.target array, for driver-agnostic safety", () => {
        const e = { code: "P2002", meta: { target: ["trackId", "position"] } }
        assert.equal(isUniqueViolationOn(e, "position"), true)
        assert.equal(isUniqueViolationOn(e, "slug"), false)
    })

    it("still reads a string meta.target", () => {
        const e = { code: "P2002", meta: { target: "trackId_position" } }
        assert.equal(isUniqueViolationOn(e, "position"), true)
    })

    it("returns false when meta is absent entirely", () => {
        assert.equal(isUniqueViolationOn({ code: "P2002" }, "slug"), false)
    })

    it("returns false for any error that is not P2002", () => {
        const e = { code: "P2025", meta: { target: ["slug"] } }
        assert.equal(isUniqueViolationOn(e, "slug"), false)
    })

    it("returns false for a non-Prisma error", () => {
        assert.equal(isUniqueViolationOn(new Error("boom"), "slug"), false)
    })
})

describe("mapWriteFailure", () => {
    it("maps a vanished record to a retryable 409", () => {
        const r = mapWriteFailure({ code: "P2025" }, "reorder modules")
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })

    it("maps a unique collision to the same retryable 409", () => {
        const r = mapWriteFailure({ code: "P2002" }, "delete module")
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })

    it("keeps a genuine error loud as a 500 carrying the verb", () => {
        const r = mapWriteFailure(new Error("connection reset"), "delete module")
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 500)
        assert.match(!r.ok ? r.error : "", /delete module/)
    })

    it("does not treat an unrelated Prisma code as retryable", () => {
        const r = mapWriteFailure({ code: "P2003" }, "reorder modules")
        assert.equal(!r.ok && r.status, 500)
    })
})

// `addLessonToModule` / `addCheckpoint` (and friends) take a real DB slug,
// same as production callers would pass. `makeArticle` / `makeProblem` store
// rows under `${PREFIX}${slug}` so cleanup() can find them by prefix — so
// call sites here must pass the prefixed slug too. (`lessonIdsInOrder` /
// `checkpointIdsInOrder` take the bare human suffix and prefix internally.)
describe("addLessonToModule", () => {
    it("appends lessons in order", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("lesson-one")
        const a2 = await makeArticle("lesson-two")
        await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: `${PREFIX}lesson-one`,
        })
        await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: `${PREFIX}lesson-two`,
        })
        assert.deepEqual(await lessonIdsInOrder("m"), [a1, a2])
    })

    it("inserts at an explicit position", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("l-a")
        const a3 = await makeArticle("l-c")
        const a2 = await makeArticle("l-b")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}l-a` })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}l-c` })
        await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: `${PREFIX}l-b`,
            position: 1,
        })
        assert.deepEqual(await lessonIdsInOrder("m"), [a1, a2, a3])
    })

    it("404s for an unknown article", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const r = await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: "no-such-article",
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })

    it("409s when the lesson is already in the module", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        await makeArticle("dupe")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}dupe` })
        const r = await addLessonToModule(TRACK_SLUG, "m", {
            articleSlug: `${PREFIX}dupe`,
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })

    it("allows the same article in two different modules", async () => {
        await createModule(TRACK_SLUG, { name: "M1", description: "d" })
        await createModule(TRACK_SLUG, { name: "M2", description: "d" })
        await makeArticle("shared")
        const r1 = await addLessonToModule(TRACK_SLUG, "m1", {
            articleSlug: `${PREFIX}shared`,
        })
        const r2 = await addLessonToModule(TRACK_SLUG, "m2", {
            articleSlug: `${PREFIX}shared`,
        })
        assert.equal(r1.ok, true)
        assert.equal(r2.ok, true)
    })
})

describe("removeLessonFromModule", () => {
    it("removes and closes the position gap", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("r-a")
        await makeArticle("r-b")
        const a3 = await makeArticle("r-c")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}r-a` })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}r-b` })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}r-c` })
        const r = await removeLessonFromModule(TRACK_SLUG, "m", `${PREFIX}r-b`)
        assert.equal(r.ok, true)
        assert.deepEqual(await lessonIdsInOrder("m"), [a1, a3])
    })
})

describe("reorderModuleLessons", () => {
    it("applies the requested order", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        const a1 = await makeArticle("o-a")
        const a2 = await makeArticle("o-b")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}o-a` })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}o-b` })
        const r = await reorderModuleLessons(TRACK_SLUG, "m", [
            `${PREFIX}o-b`,
            `${PREFIX}o-a`,
        ])
        assert.equal(r.ok, true)
        assert.deepEqual(await lessonIdsInOrder("m"), [a2, a1])
    })

    it("400s when the payload omits a lesson", async () => {
        await createModule(TRACK_SLUG, { name: "M", description: "d" })
        await makeArticle("p-a")
        await makeArticle("p-b")
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}p-a` })
        await addLessonToModule(TRACK_SLUG, "m", { articleSlug: `${PREFIX}p-b` })
        const r = await reorderModuleLessons(TRACK_SLUG, "m", [`${PREFIX}p-a`])
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 400)
    })
})

describe("addCheckpoint", () => {
    it("appends checkpoints in order", async () => {
        await makeArticle("cp-lesson")
        const p1 = await makeProblem("cp-one")
        const p2 = await makeProblem("cp-two")
        await addCheckpoint(`${PREFIX}cp-lesson`, {
            problemSlug: `${PREFIX}cp-one`,
        })
        await addCheckpoint(`${PREFIX}cp-lesson`, {
            problemSlug: `${PREFIX}cp-two`,
        })
        assert.deepEqual(await checkpointIdsInOrder("cp-lesson"), [p1, p2])
    })

    it("409s when the problem already checks another lesson", async () => {
        await makeArticle("cp-l1")
        await makeArticle("cp-l2")
        await makeProblem("cp-shared")
        await addCheckpoint(`${PREFIX}cp-l1`, {
            problemSlug: `${PREFIX}cp-shared`,
        })
        const r = await addCheckpoint(`${PREFIX}cp-l2`, {
            problemSlug: `${PREFIX}cp-shared`,
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 409)
    })

    it("404s for an unknown problem", async () => {
        await makeArticle("cp-l3")
        const r = await addCheckpoint(`${PREFIX}cp-l3`, {
            problemSlug: "no-such-problem",
        })
        assert.equal(r.ok, false)
        assert.equal(!r.ok && r.status, 404)
    })
})

describe("removeCheckpoint / reorderCheckpoints", () => {
    it("removes and closes the gap", async () => {
        await makeArticle("rm-lesson")
        const p1 = await makeProblem("rm-one")
        await makeProblem("rm-two")
        const p3 = await makeProblem("rm-three")
        await addCheckpoint(`${PREFIX}rm-lesson`, {
            problemSlug: `${PREFIX}rm-one`,
        })
        await addCheckpoint(`${PREFIX}rm-lesson`, {
            problemSlug: `${PREFIX}rm-two`,
        })
        await addCheckpoint(`${PREFIX}rm-lesson`, {
            problemSlug: `${PREFIX}rm-three`,
        })
        const r = await removeCheckpoint(`${PREFIX}rm-lesson`, `${PREFIX}rm-two`)
        assert.equal(r.ok, true)
        assert.deepEqual(await checkpointIdsInOrder("rm-lesson"), [p1, p3])
    })

    it("reorders", async () => {
        await makeArticle("ro-lesson")
        const p1 = await makeProblem("ro-one")
        const p2 = await makeProblem("ro-two")
        await addCheckpoint(`${PREFIX}ro-lesson`, {
            problemSlug: `${PREFIX}ro-one`,
        })
        await addCheckpoint(`${PREFIX}ro-lesson`, {
            problemSlug: `${PREFIX}ro-two`,
        })
        const r = await reorderCheckpoints(`${PREFIX}ro-lesson`, [
            `${PREFIX}ro-two`,
            `${PREFIX}ro-one`,
        ])
        assert.equal(r.ok, true)
        assert.deepEqual(await checkpointIdsInOrder("ro-lesson"), [p2, p1])
    })
})
