import { test, expect } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    SESSION_COOKIE_NAME,
} from "./fixtures/db"

const ADMIN_EMAIL = "e2e-learn-admin@example.test"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

function cookie(t: string): string {
    return `${SESSION_COOKIE_NAME}=${t}`
}

test.describe.configure({ mode: "serial" })

test.afterAll(async () => {
    // Clean up any leftover test articles + topics
    await prisma.article.deleteMany({
        where: { slug: { startsWith: "e2e-" } },
    })
    await prisma.topic.deleteMany({
        where: { slug: { startsWith: "e2e-" } },
    })
    await deleteUser(ADMIN_EMAIL)
    await prisma.$disconnect()
})

test.describe("Learn — admin CMS + approval queue", () => {
    test("draft article is invisible to anonymous viewers", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        // Make sure there's a topic to attach to
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no Topic in DB")
        const draft = await prisma.article.create({
            data: {
                title: "E2E draft article",
                slug: `e2e-draft-${Date.now()}`,
                topicId: topic!.id,
                authorId: admin.id,
                content: "secret-draft-body",
                status: "DRAFT",
            },
        })
        try {
            const html = await (
                await request.get(`/learn/${topic!.slug}/${draft.slug}`, {
                    failOnStatusCode: false,
                })
            ).text()
            expect(html).not.toContain("secret-draft-body")
            expect(html.toLowerCase()).toContain("not found")
        } finally {
            await prisma.article.delete({ where: { id: draft.id } })
        }
    })

    test("submitted article is invisible to anonymous viewers", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no Topic in DB")
        const article = await prisma.article.create({
            data: {
                title: "E2E in-review article",
                slug: `e2e-submitted-${Date.now()}`,
                topicId: topic!.id,
                authorId: admin.id,
                content: "in-review-body",
                status: "SUBMITTED",
            },
        })
        try {
            const html = await (
                await request.get(`/learn/${topic!.slug}/${article.slug}`, {
                    failOnStatusCode: false,
                })
            ).text()
            expect(html).not.toContain("in-review-body")
            expect(html.toLowerCase()).toContain("not found")
        } finally {
            await prisma.article.delete({ where: { id: article.id } })
        }
    })

    test("admin can create → submit → approve via API; PUBLISHED visible publicly", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const topic = await prisma.topic.findFirst({ select: { slug: true, id: true } })
        test.skip(!topic, "no Topic in DB")

        const slug = `e2e-flow-${Date.now()}`
        // 1. Create as DRAFT
        const createRes = await request.post("/api/admin/articles", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: {
                title: "E2E flow article",
                slug,
                topicSlug: topic!.slug,
                content: "# Hello\n\nbody-public",
                summary: "test summary",
                status: "DRAFT",
            },
            failOnStatusCode: false,
        })
        expect(createRes.status()).toBe(201)

        try {
            // 2. Submit
            const submitRes = await request.post(
                `/api/admin/articles/${slug}/submit`,
                {
                    headers: {
                        Origin: BASE_URL,
                        Cookie: cookie(admin.sessionToken),
                    },
                    failOnStatusCode: false,
                }
            )
            expect(submitRes.status()).toBe(200)
            expect((await submitRes.json()).status).toBe("SUBMITTED")

            // Should now be in /admin/articles?status=SUBMITTED queue
            const queueCount = await prisma.article.count({
                where: { status: "SUBMITTED", slug },
            })
            expect(queueCount).toBe(1)

            // 3. Approve — should snapshot a version + flip to PUBLISHED
            const approveRes = await request.post(
                `/api/admin/articles/${slug}/approve`,
                {
                    headers: {
                        Origin: BASE_URL,
                        Cookie: cookie(admin.sessionToken),
                    },
                    failOnStatusCode: false,
                }
            )
            expect(approveRes.status()).toBe(200)
            expect((await approveRes.json()).status).toBe("PUBLISHED")

            // Snapshot should exist
            const versionCount = await prisma.articleVersion.count({
                where: { article: { slug } },
            })
            expect(versionCount).toBe(1)

            // 4. Publicly visible
            const html = await (
                await request.get(`/learn/${topic!.slug}/${slug}`)
            ).text()
            expect(html).toContain("body-public")
            expect(html).toContain("test summary")
        } finally {
            await prisma.article.deleteMany({ where: { slug } })
        }
    })

    test("reject sends article back to DRAFT with reviewNotes", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no Topic in DB")
        const article = await prisma.article.create({
            data: {
                title: "E2E rejectee",
                slug: `e2e-reject-${Date.now()}`,
                topicId: topic!.id,
                authorId: admin.id,
                content: "body",
                status: "SUBMITTED",
            },
        })
        try {
            const res = await request.post(
                `/api/admin/articles/${article.slug}/reject`,
                {
                    headers: {
                        Origin: BASE_URL,
                        "Content-Type": "application/json",
                        Cookie: cookie(admin.sessionToken),
                    },
                    data: { reviewNotes: "Fix the intro paragraph please." },
                    failOnStatusCode: false,
                }
            )
            expect(res.status()).toBe(200)
            const refreshed = await prisma.article.findUnique({
                where: { id: article.id },
                select: { status: true, reviewNotes: true },
            })
            expect(refreshed?.status).toBe("DRAFT")
            expect(refreshed?.reviewNotes).toMatch(/intro paragraph/i)
        } finally {
            await prisma.article.delete({ where: { id: article.id } })
        }
    })

    test("reading time is computed at create and recomputed on PATCH", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no Topic in DB")

        const slug = `e2e-rt-${Date.now()}`
        // ~50 words → 1 minute (the floor is 1)
        const shortContent = Array(50).fill("word").join(" ")
        const createRes = await request.post("/api/admin/articles", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: {
                title: "Reading time test",
                slug,
                topicSlug: topic!.slug,
                content: shortContent,
                status: "DRAFT",
            },
            failOnStatusCode: false,
        })
        expect(createRes.status()).toBe(201)
        try {
            const a1 = await prisma.article.findUnique({
                where: { slug },
                select: { readingMinutes: true },
            })
            expect(a1?.readingMinutes).toBe(1)

            // Now bump to ~600 words → 3 minutes
            const longContent = Array(600).fill("word").join(" ")
            const patchRes = await request.patch(
                `/api/admin/articles/${slug}`,
                {
                    headers: {
                        Origin: BASE_URL,
                        "Content-Type": "application/json",
                        Cookie: cookie(admin.sessionToken),
                    },
                    data: { content: longContent },
                    failOnStatusCode: false,
                }
            )
            expect(patchRes.status()).toBe(200)
            const a2 = await prisma.article.findUnique({
                where: { slug },
                select: { readingMinutes: true },
            })
            expect(a2?.readingMinutes).toBe(3)
        } finally {
            await prisma.article.deleteMany({ where: { slug } })
        }
    })

    test("cross-link: related problem appears on the article page; related article on the practice page", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no Topic in DB")
        const problem = await prisma.sQLProblem.findFirst({
            where: { status: "PUBLISHED" },
            select: { slug: true, title: true },
        })
        test.skip(!problem, "no PUBLISHED problem in DB")

        const slug = `e2e-link-${Date.now()}`
        const article = await prisma.article.create({
            data: {
                title: "E2E linked article",
                slug,
                topicId: topic!.id,
                authorId: admin.id,
                content: "linked-body",
                summary: "Linked-summary text.",
                status: "PUBLISHED",
                relatedProblems: {
                    connect: [{ slug: problem!.slug }],
                },
            },
        })
        try {
            // Article page → related problem panel renders
            const articleHtml = await (
                await request.get(`/learn/${topic!.slug}/${slug}`)
            ).text()
            expect(articleHtml).toContain("Practice this")
            expect(articleHtml).toContain(problem!.title)

            // Practice page → related article panel renders
            const practiceHtml = await (
                await request.get(`/practice/${problem!.slug}`)
            ).text()
            expect(practiceHtml).toContain("Read more")
            expect(practiceHtml).toContain("E2E linked article")
        } finally {
            await prisma.article.delete({ where: { id: article.id } })
        }
    })
})
