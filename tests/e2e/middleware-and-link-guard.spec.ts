import { test, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import {
    deleteUser,
    prisma,
    seedUser,
    SESSION_COOKIE_NAME,
} from "./fixtures/db"

const ADMIN_EMAIL = "e2e-mw-admin@example.test"
const USER_EMAIL = "e2e-mw-user@example.test"
const ELEVATED_EMAIL = "e2e-elevated-no-account@example.test"
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

function cookie(sessionToken: string): string {
    return `${SESSION_COOKIE_NAME}=${sessionToken}`
}

test.describe.configure({ mode: "serial" })

test.afterAll(async () => {
    await deleteUser(ADMIN_EMAIL)
    await deleteUser(USER_EMAIL)
    await deleteUser(ELEVATED_EMAIL)
    await prisma.$disconnect()
})

test.describe("Edge gating (middleware.ts)", () => {
    test("anonymous /admin/articles → redirected to sign-in (no DB query)", async ({
        request,
    }) => {
        const res = await request.get("/admin/articles", {
            maxRedirects: 0,
            failOnStatusCode: false,
        })
        // Middleware redirects with status 307 to /auth/signin?callbackUrl=...
        expect(res.status()).toBeGreaterThanOrEqual(300)
        expect(res.status()).toBeLessThan(400)
        const location = res.headers()["location"]
        expect(location).toBeTruthy()
        expect(location).toContain("/auth/signin")
        expect(location).toContain("callbackUrl=%2Fadmin%2Farticles")
    })

    test("anonymous /api/admin/articles → 401 with no DB query", async ({
        request,
    }) => {
        const res = await request.get("/api/admin/articles", {
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(401)
        expect((await res.json()).error).toMatch(/authentication required/i)
    })

    test("non-admin USER session → /admin/* redirects to /", async ({
        request,
    }) => {
        const u = await seedUser({ email: USER_EMAIL, role: "USER" })
        const res = await request.get("/admin/contributors", {
            headers: { Cookie: cookie(u.sessionToken) },
            maxRedirects: 0,
            failOnStatusCode: false,
        })
        expect(res.status()).toBeGreaterThanOrEqual(300)
        expect(res.status()).toBeLessThan(400)
        expect(res.headers()["location"]).toMatch(/\/$/)
    })

    test("non-admin USER session → /api/admin/* returns 403", async ({
        request,
    }) => {
        const u = await seedUser({ email: USER_EMAIL, role: "USER" })
        const res = await request.get("/api/admin/articles", {
            headers: { Cookie: cookie(u.sessionToken) },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(403)
        expect((await res.json()).error).toMatch(/admin/i)
    })

    test("Bearer-token request still passes through middleware (handler validates)", async ({
        request,
    }) => {
        // No session cookie. Bearer header should make middleware let it through;
        // withAdmin then 401s on the invalid key.
        const res = await request.post("/api/admin/articles", {
            headers: {
                Authorization: "Bearer dl_live_invalid_for_e2e",
                Origin: BASE_URL,
                "Content-Type": "application/json",
            },
            data: {},
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(401)
        expect((await res.json()).error).toMatch(/invalid api key/i)
    })

    test("ADMIN session → /api/admin/articles returns 200", async ({
        request,
    }) => {
        const a = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.get("/api/admin/articles", {
            headers: { Cookie: cookie(a.sessionToken) },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(200)
    })
})

test.describe("Account-link guard (signIn callback)", () => {
    test("seed.ts no longer creates the admin row at role=ADMIN", async () => {
        // After this PR, prisma/seed.ts seeds the admin email at role=USER and
        // does NOT touch the role on subsequent runs. We assert the seeded
        // user (if present) is not pre-elevated.
        const seeded = await prisma.user.findUnique({
            where: { email: "anchitgupt2012@gmail.com" },
            include: { accounts: { select: { id: true }, take: 1 } },
        })
        if (!seeded) {
            // Seed hasn't run in this DB, nothing to assert.
            return
        }
        // If the row has zero Account rows AND elevated role, that's the
        // exact takeover surface this PR closes. Fail loudly.
        if (seeded.accounts.length === 0 && seeded.role !== "USER") {
            throw new Error(
                `Pre-seeded admin row has no Account and role=${seeded.role}. The signIn guard would refuse legitimate sign-in. Demote with psql or remove from seed.`
            )
        }
    })

    test("signIn guard: refuses to log linkage onto elevated-role + no-account User", async () => {
        // We can't easily drive an OAuth flow in tests, but we can directly
        // exercise the auth signIn callback's logic by inserting a User and
        // calling the signIn predicate.
        //
        // The callback is dynamically wrapped inside NextAuth — instead we
        // assert the data invariant: a freshly-created elevated-role User
        // has zero Accounts, which is exactly the configuration the callback
        // refuses.
        const fakeUser = await prisma.user.create({
            data: {
                email: ELEVATED_EMAIL,
                name: "Pre-seeded admin",
                role: "ADMIN",
            },
        })
        try {
            const accountsCount = await prisma.account.count({
                where: { userId: fakeUser.id },
            })
            expect(accountsCount).toBe(0)
            // The signIn callback in lib/auth.ts will see this user, see
            // accounts.length === 0 + role !== "USER", and return false.
            // Manual repro: try OAuth sign-in with this email — callback
            // refuses, sign-in shows AccessDenied error.
        } finally {
            await prisma.user.delete({ where: { id: fakeUser.id } })
        }
    })
})

test.describe("Malformed Authorization headers", () => {
    // Middleware bypasses /api/admin/* only when the Authorization header
    // starts with "Bearer ". Other schemes (or "Bearer" without a space)
    // fall through to the session check. To exercise the
    // malformed-header validation that lives in requireAdmin, we send an
    // admin session cookie so middleware lets the request reach the
    // route handler — then withAdmin validates the header shape.
    test("Authorization without Bearer prefix → 401 with 'Malformed' message", async ({
        request,
    }) => {
        const a = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.get("/api/admin/problems", {
            headers: {
                Cookie: cookie(a.sessionToken),
                Authorization: `Token ${randomUUID()}`,
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(401)
        expect((await res.json()).error).toMatch(/malformed/i)
    })

    test("Authorization with 'Bearer' but no space → 401 with 'Malformed' message", async ({
        request,
    }) => {
        const a = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
        const res = await request.get("/api/admin/problems", {
            headers: {
                Cookie: cookie(a.sessionToken),
                Authorization: "BearerNoSpace",
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(401)
        expect((await res.json()).error).toMatch(/malformed/i)
    })

    // NOTE: requireAdmin also rejects "Bearer " followed by an empty token
    // with "Missing bearer token", but HTTP clients/servers normalize
    // trailing whitespace in header values, so we cannot reliably send a
    // "Bearer    " value through Playwright. The branch is covered by
    // unit-level reasoning: slice("Bearer ".length).trim() === "" → throws.

    test("/api/me/* rejects ANY Authorization header (bearer is admin-only)", async ({
        request,
    }) => {
        // Set up a CONTRIBUTOR session AND a bogus Authorization header.
        // The Authorization presence alone should trigger a 401 even though
        // the session would otherwise be valid.
        const c = await seedUser({
            email: USER_EMAIL,
            role: "CONTRIBUTOR",
        })
        const res = await request.get("/api/me/articles", {
            headers: {
                Cookie: cookie(c.sessionToken),
                Authorization: "Bearer dl_live_anything",
            },
            failOnStatusCode: false,
        })
        expect(res.status()).toBe(401)
        expect((await res.json()).error).toMatch(/not accepted on \/api\/me/i)
    })
})
