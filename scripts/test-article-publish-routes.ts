import "dotenv/config"
import assert from "node:assert/strict"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const BASE = process.env.TEST_BASE_URL ?? "http://localhost:3000"
const TEST_PREFIX = "test-prc-visual"
const ARTICLE_SLUGS = [
    `${TEST_PREFIX}-bad-alt`,
    `${TEST_PREFIX}-good-create`,
    `${TEST_PREFIX}-foreign`,
    `${TEST_PREFIX}-cross-owner`,
    `${TEST_PREFIX}-submitted`,
    `${TEST_PREFIX}-submit-bad`,
]
const USER_IDS = [
    `${TEST_PREFIX}-admin`,
    `${TEST_PREFIX}-contrib-other`,
    `${TEST_PREFIX}-contrib-approve`,
    `${TEST_PREFIX}-contrib-submit`,
]
const TOPIC_SLUG = `${TEST_PREFIX}-topic`

async function cleanup() {
    await prisma.article.deleteMany({ where: { slug: { in: ARTICLE_SLUGS } } })
    await prisma.asset.deleteMany({ where: { ownerId: { in: USER_IDS } } })
    await prisma.userAssetQuota.deleteMany({ where: { userId: { in: USER_IDS } } })
    await prisma.topic.deleteMany({ where: { slug: TOPIC_SLUG } })
    await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } })
}

async function seedAdmin() {
    const id = USER_IDS[0]
    await prisma.user.upsert({
        where: { id },
        create: { id, email: `${id}@test.local`, role: "ADMIN" },
        update: { role: "ADMIN" },
    })
    return id
}

async function seedContributor(index: number) {
    const id = USER_IDS[index]
    await prisma.user.upsert({
        where: { id },
        create: { id, email: `${id}@test.local`, role: "CONTRIBUTOR" },
        update: { role: "CONTRIBUTOR" },
    })
    return id
}

async function seedActiveAsset(ownerId: string, suffix: string) {
    return prisma.asset.create({
        data: {
            ownerId,
            blobUrl: `https://store.vercel-storage.com/learn/${ownerId}/${suffix}.svg`,
            blobKey: `learn/${ownerId}/${suffix}.svg`,
            contentType: "image/svg+xml",
            bytes: 100,
            status: "ACTIVE",
        },
    })
}

async function seedTopic() {
    return prisma.topic.upsert({
        where: { slug: TOPIC_SLUG },
        create: { name: "Test PRC Visual", slug: TOPIC_SLUG },
        update: {},
    })
}

function userFetch(userId: string) {
    return (path: string, init?: RequestInit) =>
        fetch(`${BASE}${path}`, {
            ...init,
            headers: { ...init?.headers, "X-Test-User-Id": userId },
        })
}

async function assertStatus(response: Response, expected: number) {
    if (response.status !== expected) {
        assert.equal(response.status, expected, await response.text())
    }
}

async function main() {
    await cleanup()

    const admin = await seedAdmin()
    const topic = await seedTopic()
    const adminFetch = userFetch(admin)
    const adminAsset = await seedActiveAsset(admin, "admin-owned")

    try {
        const badAlt = await adminFetch("/api/admin/articles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                title: "BadAlt",
                slug: `${TEST_PREFIX}-bad-alt`,
                status: "PUBLISHED",
                content: `:::figure{src="${adminAsset.blobUrl}"}\nx\n:::`,
                topicSlug: topic.slug,
            }),
        })
        await assertStatus(badAlt, 400)

        const okCreate = await adminFetch("/api/admin/articles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                title: "Good",
                slug: `${TEST_PREFIX}-good-create`,
                status: "PUBLISHED",
                content: `:::figure{src="${adminAsset.blobUrl}" alt="x"}\nx\n:::`,
                topicSlug: topic.slug,
            }),
        })
        await assertStatus(okCreate, 201)
        const created = await prisma.article.findUniqueOrThrow({
            where: { slug: `${TEST_PREFIX}-good-create` },
        })
        assert.equal(created.hasVisualBlocks, true)

        const foreign = await adminFetch("/api/admin/articles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                title: "Foreign",
                slug: `${TEST_PREFIX}-foreign`,
                status: "PUBLISHED",
                content: `:::figure{src="https://store.vercel-storage.com/some/foreign-url.svg" alt="x"}\nx\n:::`,
                topicSlug: topic.slug,
            }),
        })
        await assertStatus(foreign, 400)

        const otherUser = await seedContributor(1)
        const otherAsset = await seedActiveAsset(otherUser, "other-owned")
        const crossOwner = await adminFetch("/api/admin/articles", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                title: "CrossOwn",
                slug: `${TEST_PREFIX}-cross-owner`,
                status: "PUBLISHED",
                content: `:::figure{src="${otherAsset.blobUrl}" alt="x"}\nx\n:::`,
                topicSlug: topic.slug,
            }),
        })
        await assertStatus(crossOwner, 400)

        const patchBad = await adminFetch(
            `/api/admin/articles/${TEST_PREFIX}-good-create`,
            {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    content: `:::callout{kind="bogus"}\nx\n:::`,
                }),
            }
        )
        await assertStatus(patchBad, 400)

        const patchClear = await adminFetch(
            `/api/admin/articles/${TEST_PREFIX}-good-create`,
            {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    content: "# Plain prose now\n\nNo directives.",
                }),
            }
        )
        await assertStatus(patchClear, 200)
        const refreshed = await prisma.article.findUniqueOrThrow({
            where: { slug: `${TEST_PREFIX}-good-create` },
        })
        assert.equal(refreshed.hasVisualBlocks, false)

        const approvalUser = await seedContributor(2)
        const approvalAsset = await seedActiveAsset(approvalUser, "approval")
        const draft = await prisma.article.create({
            data: {
                title: "Submitted",
                slug: `${TEST_PREFIX}-submitted`,
                status: "SUBMITTED",
                content: `:::figure{src="${approvalAsset.blobUrl}"}\nbad no alt\n:::`,
                authorId: approvalUser,
                topicId: topic.id,
            },
        })
        const approve = await adminFetch(
            `/api/admin/articles/${TEST_PREFIX}-submitted/approve`,
            { method: "POST" }
        )
        await assertStatus(approve, 400)

        await prisma.article.update({
            where: { id: draft.id },
            data: {
                content: `:::figure{src="${approvalAsset.blobUrl}" alt="ok"}\nbody\n:::`,
            },
        })
        const approveOk = await adminFetch(
            `/api/admin/articles/${TEST_PREFIX}-submitted/approve`,
            { method: "POST" }
        )
        await assertStatus(approveOk, 200)
        const approved = await prisma.article.findUniqueOrThrow({
            where: { slug: `${TEST_PREFIX}-submitted` },
        })
        assert.equal(approved.hasVisualBlocks, true)

        const submitUser = await seedContributor(3)
        await prisma.article.create({
            data: {
                title: "SubmitBad",
                slug: `${TEST_PREFIX}-submit-bad`,
                status: "DRAFT",
                content: `:::callout{kind="oops"}\nx\n:::`,
                authorId: submitUser,
                topicId: topic.id,
            },
        })
        const submit = await userFetch(submitUser)(
            `/api/me/articles/${TEST_PREFIX}-submit-bad/submit`,
            { method: "POST" }
        )
        await assertStatus(submit, 400)
        const submitBody = (await submit.json()) as { advisory?: boolean }
        assert.equal(submitBody.advisory, true)

        console.log("test-article-publish-routes PASS")
    } finally {
        await cleanup()
    }
}

main()
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
    .finally(() => prisma.$disconnect())
