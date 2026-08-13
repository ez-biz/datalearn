// Community-approach behaviour against a real Postgres.
//
// Tests lib/workspace/approaches.ts rather than actions/approaches.ts: the
// actions only resolve the session and delegate, and auth() cannot be mocked
// here. That split is why the logic lives in lib.
//
// Run: DATABASE_URL=... node --import tsx --test scripts/test-approaches.ts

import { after, before, describe, it } from "node:test"
import assert from "node:assert/strict"
import { prisma } from "../lib/prisma"
import {
    createApproach,
    getApproachesFor,
    removeApproach,
    updateApproach,
} from "../lib/workspace/approaches"

const PREFIX = "test-approaches-"
const SLUG = `${PREFIX}problem`

let problemId = ""
let alice = ""
let bob = ""

async function reset() {
    await prisma.discussionComment.deleteMany({ where: { problemId } })
    await prisma.submission.deleteMany({ where: { problemId } })
    await prisma.problemDiscussionState.deleteMany({ where: { problemId } })
}

before(async () => {
    const schema = await prisma.sqlSchema.upsert({
        where: { name: `${PREFIX}schema` },
        update: {},
        create: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (id INTEGER);" },
    })
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.upsert({
        where: { slug: SLUG },
        update: {},
        create: {
            number: (max._max.number ?? 0) + 1,
            title: "Approaches fixture",
            slug: SLUG,
            difficulty: "EASY",
            status: "PUBLISHED",
            description: "fixture",
            schemaDescription: "fixture",
            schemaId: schema.id,
            expectedOutput: "[]",
        },
    })
    problemId = problem.id

    const a = await prisma.user.upsert({
        where: { email: `${PREFIX}alice@example.test` },
        update: {},
        create: { email: `${PREFIX}alice@example.test`, name: "Alice" },
    })
    const b = await prisma.user.upsert({
        where: { email: `${PREFIX}bob@example.test` },
        update: {},
        create: { email: `${PREFIX}bob@example.test`, name: "Bob" },
    })
    alice = a.id
    bob = b.id
    await reset()
})

after(async () => {
    await reset()
    await prisma.sQLProblem.deleteMany({ where: { slug: SLUG } })
    await prisma.sqlSchema.deleteMany({ where: { name: `${PREFIX}schema` } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
})

describe("createApproach", () => {
    it("stores one approach and returns it", async () => {
        await reset()
        const r = await createApproach(alice, {
            problemSlug: SLUG,
            sql: "SELECT 1;",
            strategy: "window function",
        })
        assert.equal(r.ok, true)
        const list = await getApproachesFor(SLUG, alice)
        assert.equal(list.length, 1)
        assert.equal(list[0].sql, "SELECT 1;")
        assert.equal(list[0].strategy, "window function")
        assert.equal(list[0].isMine, true)
    })

    it("refuses a second approach from the same user", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const second = await createApproach(alice, {
            problemSlug: SLUG,
            sql: "SELECT 2;",
            strategy: null,
        })
        // Returned, not thrown — the partial unique index is caught and
        // translated, which requires reading the adapter's error shape.
        assert.equal(second.ok, false)
        if (!second.ok) assert.match(second.reason, /already shared/i)
    })

    it("lets a different user post their own", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const r = await createApproach(bob, { problemSlug: SLUG, sql: "SELECT 2;", strategy: null })
        assert.equal(r.ok, true)
        assert.equal((await getApproachesFor(SLUG, alice)).length, 2)
    })

    it("still allows many ordinary comments from one user", async () => {
        await reset()
        for (let i = 0; i < 3; i++) {
            await prisma.discussionComment.create({
                data: { problemId, userId: alice, bodyMarkdown: `c${i}` },
            })
        }
        const comments = await prisma.discussionComment.count({
            where: { problemId, kind: "COMMENT" },
        })
        assert.equal(comments, 3)
    })

    it("rejects an empty query", async () => {
        await reset()
        const r = await createApproach(alice, { problemSlug: SLUG, sql: "   ", strategy: null })
        assert.equal(r.ok, false)
    })
})

describe("kind isolation", () => {
    it("getApproachesFor returns no ordinary comments", async () => {
        await reset()
        await prisma.discussionComment.create({
            data: { problemId, userId: alice, bodyMarkdown: "just a comment" },
        })
        assert.deepEqual(await getApproachesFor(SLUG, alice), [])
    })

    it("the discussion thread query returns no approaches", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        // Same where-clause the discussion API uses.
        const thread = await prisma.discussionComment.findMany({
            where: { problemId, parentId: null, kind: "COMMENT", status: "VISIBLE" },
        })
        assert.equal(thread.length, 0)
    })
})

describe("verified mark", () => {
    it("is false without an accepted submission", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const [row] = await getApproachesFor(SLUG, alice)
        assert.equal(row.verified, false)
    })

    it("is false when the author's only submission was wrong", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        await prisma.submission.create({
            data: { userId: alice, problemId, status: "WRONG_ANSWER", code: "x" },
        })
        const [row] = await getApproachesFor(SLUG, alice)
        assert.equal(row.verified, false)
    })

    it("flips to true after acceptance, without rewriting the row", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const before = await getApproachesFor(SLUG, alice)
        assert.equal(before[0].verified, false)

        await prisma.submission.create({
            data: { userId: alice, problemId, status: "ACCEPTED", code: "x" },
        })
        const afterRows = await getApproachesFor(SLUG, alice)
        assert.equal(afterRows[0].verified, true)
        // Same row — verification is computed, never stored.
        assert.equal(afterRows[0].id, before[0].id)
    })

    it("does not credit another user's acceptance", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        await prisma.submission.create({
            data: { userId: bob, problemId, status: "ACCEPTED", code: "x" },
        })
        const [row] = await getApproachesFor(SLUG, alice)
        assert.equal(row.verified, false)
    })
})

describe("moderation modes", () => {
    it("LOCKED refuses new approaches but keeps them readable", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        await prisma.problemDiscussionState.create({
            data: { problemId, mode: "LOCKED" },
        })
        const blocked = await createApproach(bob, {
            problemSlug: SLUG,
            sql: "SELECT 2;",
            strategy: null,
        })
        assert.equal(blocked.ok, false)
        assert.equal((await getApproachesFor(SLUG, alice)).length, 1)
    })

    it("HIDDEN hides the list entirely", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        await prisma.problemDiscussionState.create({
            data: { problemId, mode: "HIDDEN" },
        })
        assert.deepEqual(await getApproachesFor(SLUG, alice), [])
    })

    it("a HIDDEN status row is excluded", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        await prisma.discussionComment.updateMany({
            where: { problemId, kind: "APPROACH" },
            data: { status: "HIDDEN" },
        })
        assert.deepEqual(await getApproachesFor(SLUG, alice), [])
    })
})

describe("ownership", () => {
    it("a user cannot edit someone else's approach", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const [row] = await getApproachesFor(SLUG, alice)
        const r = await updateApproach(bob, {
            id: row.id,
            sql: "SELECT 999;",
            strategy: null,
        })
        assert.equal(r.ok, false)
        const [unchanged] = await getApproachesFor(SLUG, alice)
        assert.equal(unchanged.sql, "SELECT 1;")
    })

    it("a user cannot delete someone else's approach", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const [row] = await getApproachesFor(SLUG, alice)
        const r = await removeApproach(bob, row.id)
        assert.equal(r.ok, false)
        assert.equal((await getApproachesFor(SLUG, alice)).length, 1)
    })

    it("the author can edit and delete their own", async () => {
        await reset()
        await createApproach(alice, { problemSlug: SLUG, sql: "SELECT 1;", strategy: null })
        const [row] = await getApproachesFor(SLUG, alice)

        const edited = await updateApproach(alice, {
            id: row.id,
            sql: "SELECT 42;",
            strategy: "cte",
        })
        assert.equal(edited.ok, true)
        const [after] = await getApproachesFor(SLUG, alice)
        assert.equal(after.sql, "SELECT 42;")
        assert.equal(after.strategy, "cte")
        assert.notEqual(after.editedAt, null)

        const removed = await removeApproach(alice, row.id)
        assert.equal(removed.ok, true)
        assert.deepEqual(await getApproachesFor(SLUG, alice), [])
    })
})
