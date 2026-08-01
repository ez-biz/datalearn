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
    createModule,
    deleteModule,
    isUniqueViolationOn,
    mapWriteFailure,
    reorderModules,
    updateModule,
} from "../lib/admin-curriculum"

const PREFIX = "curriculumtest-"
const TRACK_SLUG = `${PREFIX}track`

let pool: pg.Pool
let prisma: PrismaClient
let trackId: string

async function cleanup() {
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
}

before(async () => {
    if (!process.env.DATABASE_URL) {
        throw new Error("DATABASE_URL is required for curriculum tests")
    }
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) })
    await cleanup()
})

beforeEach(async () => {
    await prisma.module.deleteMany({ where: { track: { slug: TRACK_SLUG } } })
    await prisma.track.deleteMany({ where: { slug: TRACK_SLUG } })
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
