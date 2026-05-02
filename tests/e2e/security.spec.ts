import { test, expect } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    SESSION_COOKIE_NAME,
} from "./fixtures/db"

const ADMIN_EMAIL = "e2e-admin@example.test"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

/** Build a Cookie header. Bypasses Playwright's cookie jar entirely. */
function cookie(sessionToken: string): string {
    return `${SESSION_COOKIE_NAME}=${sessionToken}`
}

test.describe.configure({ mode: "serial" })

test.afterAll(async () => {
    await deleteUser(ADMIN_EMAIL)
    await prisma.$disconnect()
})

test.describe("PR #11 — critical / high security fixes", () => {
    test("answer key not in /practice list HTML", async ({ request }) => {
        const html = await (await request.get("/practice")).text()
        expect(html).not.toContain("expectedOutput")
        expect(html).not.toContain("solutionSql")
    })

    test("answer key not in /practice/<slug> HTML", async ({ request }) => {
        const html = await (
            await request.get("/practice/simple-select")
        ).text()
        expect(html).not.toContain("expectedOutput")
        expect(html).not.toContain("solutionSql")
    })

    test("CSRF: cross-origin POST to /api/admin/* → 403", async ({
        request,
    }) => {
        // Send an ADMIN session cookie so the request clears the new
        // edge middleware (which otherwise 401s anonymous /api/admin/*
        // before requireAdmin's CSRF check runs). This faithfully
        // models the actual CSRF threat: a logged-in admin tricked
        // into making a cross-origin write.
        const a = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.post("/api/admin/problems", {
            headers: {
                Cookie: cookie(a.sessionToken),
                Origin: "https://evil.example",
                "Content-Type": "application/json",
            },
            data: {},
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
        expect((await res.json()).error).toMatch(/cross-origin/i)
    })

    test("CSRF: missing Origin on a write → 403", async ({ request }) => {
        const a = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.post("/api/admin/problems", {
            headers: {
                Cookie: cookie(a.sessionToken),
                "Content-Type": "application/json",
            },
            data: {},
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
        expect((await res.json()).error).toMatch(/origin/i)
    })

    test("CSRF: bearer auth bypasses Origin gate (rejected on bad token, not on Origin)", async ({
        request,
    }) => {
        const res = await request.post("/api/admin/problems", {
            headers: {
                Authorization: "Bearer dl_live_invalid_token_for_e2e",
                Origin: "https://evil.example",
                "Content-Type": "application/json",
            },
            data: {},
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(401)
        expect((await res.json()).error).toMatch(/invalid api key/i)
    })

    test("draft article 404s — status=PUBLISHED filter on getArticle", async ({
        request,
    }) => {
        const topic = await prisma.topic.findFirst()
        test.skip(!topic, "no Topic in DB to attach a draft Article to")
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const draft = await prisma.article.create({
            data: {
                title: "E2E draft",
                slug: `e2e-draft-${Date.now()}`,
                content: "secret-content-should-not-leak",
                status: "DRAFT",
                topicId: topic!.id,
                authorId: admin.id,
            },
        })
        try {
            const res = await request.get(
                `/learn/${topic!.slug}/${draft.slug}`,
                { failOnStatusCode: false }
            )
            const html = await res.text()
            // Next renders the not-found body inside a 200 from the route group
            // — we just assert the secret content is absent and the 404 page is shown.
            expect(html).not.toContain("secret-content-should-not-leak")
            expect(html.toLowerCase()).toContain("not found")
        } finally {
            await prisma.article.delete({ where: { id: draft.id } })
        }
    })

    test("anonymous viewer of a problem sees 'Sign in to report', not the report dialog button", async ({
        request,
    }) => {
        const html = await (
            await request.get("/practice/simple-select")
        ).text()
        expect(html).toContain("Sign in to report")
    })

    test("admin pages are gated — not signed in → redirect to sign-in", async ({
        request,
    }) => {
        // Edge middleware now redirects anonymous /admin/* to
        // /auth/signin?callbackUrl=... before the layout runs.
        const res = await request.get("/admin/problems", {
            maxRedirects: 0,
            failOnStatusCode: false,
        })
        expect(res.status()).toBeGreaterThanOrEqual(300)
        expect(res.status()).toBeLessThan(400)
        expect(res.headers()["location"]).toContain("/auth/signin")
    })
})

test.describe("PR #12 — medium followups", () => {
    test("security headers present on /", async ({ request }) => {
        const res = await request.get("/")
        const h = res.headers()
        expect(h["x-frame-options"]).toBe("DENY")
        expect(h["x-content-type-options"]).toBe("nosniff")
        expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin")
        // HSTS is dev-conditionally off — only assert in prod
        if (process.env.NODE_ENV === "production") {
            expect(h["strict-transport-security"]).toMatch(/max-age=/)
        }
    })

    test("API key created without expiresAt defaults to ~90 days", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.post("/api/admin/api-keys", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: { name: "e2e-default-expiry" },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(201)
        const body = await res.json()
        expect(body.data.expiresAt).toBeTruthy()
        const days =
            (new Date(body.data.expiresAt).getTime() - Date.now()) /
            (86400 * 1000)
        expect(days).toBeGreaterThan(89.9)
        expect(days).toBeLessThan(90.1)
        // cleanup
        await prisma.apiKey.delete({ where: { id: body.data.id } })
    })

    test("API key with expiresAt > 365 days → 400", async ({ request }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.post("/api/admin/api-keys", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: {
                name: "e2e-too-long",
                expiresAt: new Date(
                    Date.now() + 400 * 86400 * 1000
                ).toISOString(),
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(400)
        expect((await res.json()).error).toMatch(/365 days/i)
    })

    test("API key with expiresAt in the past → 400", async ({ request }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.post("/api/admin/api-keys", {
            headers: {
                Origin: BASE_URL,
                "Content-Type": "application/json",
                Cookie: cookie(admin.sessionToken),
            },
            data: {
                name: "e2e-past",
                expiresAt: new Date(
                    Date.now() - 86400 * 1000
                ).toISOString(),
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(400)
        expect((await res.json()).error).toMatch(/future/i)
    })

    test("admin can list problems via API with session cookie", async ({
        request,
    }) => {
        const admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.get("/api/admin/problems", {
            headers: { Cookie: cookie(admin.sessionToken) },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(200)
        const body = await res.json()
        expect(Array.isArray(body.data)).toBe(true)
    })

    test("non-admin user cannot list problems via API → 403", async ({
        request,
    }) => {
        const user = await seedUser({
            email: "e2e-plain@example.test",
            role: "USER",
        })
        try {
            const res = await request.get("/api/admin/problems", {
                headers: { Cookie: cookie(user.sessionToken) },
                failOnStatusCode: false,
            })
            expect(res.status()).toBe(403)
        } finally {
            await deleteUser("e2e-plain@example.test")
        }
    })
})
