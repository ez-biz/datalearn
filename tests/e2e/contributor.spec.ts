import { test, expect } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    SESSION_COOKIE_NAME,
} from "./fixtures/db"

const ADMIN_EMAIL = "e2e-contrib-admin@example.test"
const CONTRIBUTOR_EMAIL = "e2e-contributor@example.test"
const CONTRIBUTOR_2_EMAIL = "e2e-contributor-2@example.test"
const PLAIN_USER_EMAIL = "e2e-plain-user@example.test"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

function cookie(t: string): string {
    return `${SESSION_COOKIE_NAME}=${t}`
}

test.describe.configure({ mode: "serial" })

test.afterAll(async () => {
    await prisma.article.deleteMany({ where: { slug: { startsWith: "e2e-contrib-" } } })
    await deleteUser(ADMIN_EMAIL)
    await deleteUser(CONTRIBUTOR_EMAIL)
    await deleteUser(CONTRIBUTOR_2_EMAIL)
    await deleteUser(PLAIN_USER_EMAIL)
    await prisma.$disconnect()
})

test.describe("Contributor role + /me/articles", () => {
    test("plain USER cannot author via /api/me/articles → 403", async ({
        request,
    }) => {
        const user = await seedUser({ email: PLAIN_USER_EMAIL, role: "USER" })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no topic")
        const res = await request.post("/api/me/articles", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(user.sessionToken),
            },
            data: {
                title: "Should be rejected",
                slug: `e2e-contrib-rejected-${Date.now()}`,
                topicSlug: topic!.slug,
                content: "x",
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
        expect((await res.json()).error).toMatch(/contributor/i)
    })

    test("CONTRIBUTOR can create their own article (forced DRAFT)", async ({
        request,
    }) => {
        const c = await seedUser({
            email: CONTRIBUTOR_EMAIL,
            role: "CONTRIBUTOR",
        })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no topic")
        const slug = `e2e-contrib-mine-${Date.now()}`
        const res = await request.post("/api/me/articles", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(c.sessionToken),
            },
            data: {
                title: "My contributor article",
                slug,
                topicSlug: topic!.slug,
                content: "first draft",
                status: "PUBLISHED", // ignored — forced DRAFT
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(201)
        const created = (await res.json()).data
        expect(created.status).toBe("DRAFT")
        expect(created.authorId).toBe(c.id)
    })

    test("CONTRIBUTOR cannot edit another user's article → 404", async ({
        request,
    }) => {
        const owner = await seedUser({
            email: CONTRIBUTOR_EMAIL,
            role: "CONTRIBUTOR",
        })
        const other = await seedUser({
            email: CONTRIBUTOR_2_EMAIL,
            role: "CONTRIBUTOR",
        })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no topic")
        const ownerArticle = await prisma.article.create({
            data: {
                title: "Owner-only",
                slug: `e2e-contrib-owner-${Date.now()}`,
                topicId: topic!.id,
                authorId: owner.id,
                content: "secret",
                status: "DRAFT",
            },
        })
        try {
            const res = await request.patch(
                `/api/me/articles/${ownerArticle.slug}`,
                {
                    headers: {
                        Origin: BASE_URL,
                        "Content-Type": "application/json",
                        Cookie: cookie(other.sessionToken),
                    },
                    data: { content: "hacked" },
                    failOnStatusCode: false,
                }
            )
            expect(res.status()).toBe(404)
            const refreshed = await prisma.article.findUnique({
                where: { id: ownerArticle.id },
                select: { content: true },
            })
            expect(refreshed?.content).toBe("secret")
        } finally {
            await prisma.article.delete({ where: { id: ownerArticle.id } })
        }
    })

    test("CONTRIBUTOR can submit own draft, cannot approve/reject/archive", async ({
        request,
    }) => {
        const c = await seedUser({
            email: CONTRIBUTOR_EMAIL,
            role: "CONTRIBUTOR",
        })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no topic")
        const draft = await prisma.article.create({
            data: {
                title: "Submit me",
                slug: `e2e-contrib-submit-${Date.now()}`,
                topicId: topic!.id,
                authorId: c.id,
                content: "ready",
                status: "DRAFT",
            },
        })
        try {
            // Contributor's own submit endpoint works
            const submitRes = await request.post(
                `/api/me/articles/${draft.slug}/submit`,
                {
                    headers: {
                        Origin: BASE_URL,
                        Cookie: cookie(c.sessionToken),
                    },
                    failOnStatusCode: false,
                }
            )
            expect(submitRes.status()).toBe(200)
            expect((await submitRes.json()).status).toBe("SUBMITTED")

            // Contributor cannot hit the admin approve endpoint
            const approveRes = await request.post(
                `/api/admin/articles/${draft.slug}/approve`,
                {
                    headers: {
                        Origin: BASE_URL,
                        Cookie: cookie(c.sessionToken),
                    },
                    failOnStatusCode: false,
                }
            )
            expect(approveRes.status()).toBe(403)
            expect((await approveRes.json()).error).toMatch(/admin/i)
        } finally {
            await prisma.article.delete({ where: { id: draft.id } })
        }
    })

    test("CONTRIBUTOR cannot edit own SUBMITTED article", async ({ request }) => {
        const c = await seedUser({
            email: CONTRIBUTOR_EMAIL,
            role: "CONTRIBUTOR",
        })
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no topic")
        const submitted = await prisma.article.create({
            data: {
                title: "Locked while in review",
                slug: `e2e-contrib-locked-${Date.now()}`,
                topicId: topic!.id,
                authorId: c.id,
                content: "in review",
                status: "SUBMITTED",
            },
        })
        try {
            const res = await request.patch(
                `/api/me/articles/${submitted.slug}`,
                {
                    headers: {
                        Origin: BASE_URL,
                        "Content-Type": "application/json",
                        Cookie: cookie(c.sessionToken),
                    },
                    data: { content: "tried to sneak edit" },
                    failOnStatusCode: false,
                }
            )
            expect(res.status()).toBe(409)
            expect((await res.json()).error).toMatch(/draft/i)
        } finally {
            await prisma.article.delete({ where: { id: submitted.id } })
        }
    })
})

test.describe("Admin contributor management", () => {
    test("ADMIN can promote USER → CONTRIBUTOR", async ({ request }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const target = await seedUser({
            email: PLAIN_USER_EMAIL,
            role: "USER",
        })
        const res = await request.patch(`/api/admin/users/${target.id}`, {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: { role: "CONTRIBUTOR" },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(200)
        const refreshed = await prisma.user.findUnique({
            where: { id: target.id },
            select: { role: true },
        })
        expect(refreshed?.role).toBe("CONTRIBUTOR")
    })

    test("ADMIN cannot promote anyone to ADMIN via the API", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const target = await seedUser({
            email: PLAIN_USER_EMAIL,
            role: "USER",
        })
        const res = await request.patch(`/api/admin/users/${target.id}`, {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: { role: "ADMIN" },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
        expect((await res.json()).error).toMatch(/database/i)
    })

    test("ADMIN cannot demote another ADMIN via the API", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        // Create a second admin to attempt to demote
        const other = await seedUser({
            email: CONTRIBUTOR_2_EMAIL,
            role: "ADMIN",
        })
        try {
            const res = await request.patch(`/api/admin/users/${other.id}`, {
                headers: {
                    Origin: BASE_URL,
                    "Content-Type": "application/json",
                    Cookie: cookie(admin.sessionToken),
                },
                data: { role: "USER" },
                failOnStatusCode: false,
            })
            expect(res.status()).toBe(403)
        } finally {
            // Reset for cleanup
            await prisma.user.update({
                where: { id: other.id },
                data: { role: "USER" },
            })
        }
    })

    test("ADMIN cannot change their own role", async ({ request }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.patch(`/api/admin/users/${admin.id}`, {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: { role: "CONTRIBUTOR" },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
    })

    test("non-admin cannot list users", async ({ request }) => {
        const c = await seedUser({
            email: CONTRIBUTOR_EMAIL,
            role: "CONTRIBUTOR",
        })
        const res = await request.get("/api/admin/users", {
            headers: { Cookie: cookie(c.sessionToken) },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
    })
})
