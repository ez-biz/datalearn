import { expect, test } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    sessionCookie,
    type SeededUser,
} from "./fixtures/db"
import { FEATURED_TRACK_SLUG } from "@/lib/curriculum-featured"

/**
 * First-run onboarding — /welcome.
 *
 * Seeds its own users rather than depending on seed data, matching every
 * other spec in this directory. The no-track case is the default here: CI
 * does not run seed-analyst-track.ts, so there is no published curriculum
 * and the fallback path is what renders. That is deliberate — the fallback
 * is the branch most likely to regress silently, because it is invisible on
 * a developer machine with a seeded track.
 */
const NAMESPACE = "e2e-welcome"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const newUserEmail = `${PREFIX}-new@example.test`
const doneUserEmail = `${PREFIX}-done@example.test`
const emails = [newUserEmail, doneUserEmail]

let newUser: SeededUser
let doneUser: SeededUser

test.beforeAll(async () => {
    newUser = await seedUser({ email: newUserEmail, name: "Ada Lovelace" })
    doneUser = await seedUser({ email: doneUserEmail, name: "Grace Hopper" })

    // seedUser creates a fresh row, so both start un-onboarded. Mark one
    // complete to assert the bounce.
    await prisma.user.update({
        where: { id: newUser.id },
        data: { onboardingCompletedAt: null, onboardingStartedAt: null, sqlLevel: null },
    })
    await prisma.user.update({
        where: { id: doneUser.id },
        data: { onboardingCompletedAt: new Date() },
    })
})

test.afterAll(async () => {
    for (const email of emails) await deleteUser(email)
})

test.describe("first-run onboarding", () => {
    test("a new user is redirected from / to /welcome", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/`)
        await expect(page).toHaveURL(/\/welcome$/)
        await expect(
            page.getByRole("heading", { level: 1, name: /Welcome, Ada/ })
        ).toBeVisible()
    })

    test("exactly one banner, one main and one h1", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        // ARIA forbids banner inside main; a focus route that got this wrong
        // would still look correct on screen.
        await expect(page.getByRole("banner")).toHaveCount(1)
        await expect(page.getByRole("main")).toHaveCount(1)
        await expect(page.locator("h1")).toHaveCount(1)
    })

    test("the console sidebar is absent", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        // The console nav is labelled "Primary" (ConsoleSidebar.tsx / ConsoleRail.tsx).
        await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0)
    })

    test("a completed user visiting /welcome is bounced home", async ({ context, page }) => {
        await context.addCookies([sessionCookie(doneUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`))
    })

    test("answering records the level and shows a destination", async ({ context, page }) => {
        await context.addCookies([sessionCookie(newUser.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)

        await page.getByRole("radio", { name: /I can write JOINs/ }).check()
        await page.getByRole("button", { name: "Continue" }).click()

        // StartHereStep renders `You&rsquo;re set.` — a typographic apostrophe
        // (U+2019), matching every other user-facing string in this flow
        // (`we&rsquo;ll`, `There&rsquo;s`). A straight ASCII apostrophe here
        // would never match the real DOM text.
        await expect(page.getByRole("heading", { level: 1 })).toContainText("You’re set")

        const stored = await prisma.user.findUnique({
            where: { id: newUser.id },
            select: { sqlLevel: true, onboardingStartedAt: true },
        })
        expect(stored?.sqlLevel).toBe("INTERMEDIATE")
        // Write-on-view fired from the client effect.
        expect(stored?.onboardingStartedAt).not.toBeNull()
    })

    test("screen two always offers a real destination, never '0 lessons'", async ({ context, page }) => {
        const email = `${PREFIX}-dest@example.test`
        const fresh = await seedUser({ email })
        emails.push(email)
        await prisma.user.update({
            where: { id: fresh.id },
            data: { onboardingCompletedAt: null, onboardingStartedAt: null, sqlLevel: null },
        })

        await context.addCookies([sessionCookie(fresh.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        await page.getByRole("radio", { name: /New to SQL/ }).check()
        await page.getByRole("button", { name: "Continue" }).click()

        await expect(page.getByRole("heading", { level: 1 })).toContainText("You’re set")

        // Which branch renders depends on whether this database has a
        // published featured track with at least one lesson: CI has none, a
        // developer machine that ran seed:analyst-track has one. Assert the
        // branch that actually applies — and the honesty rule in both.
        const publishedLessonCount = await prisma.moduleLesson.count({
            where: {
                module: { track: { slug: FEATURED_TRACK_SLUG, status: "PUBLISHED" } },
            },
        })

        if (publishedLessonCount > 0) {
            await expect(page.getByRole("button", { name: "Start lesson" })).toBeVisible()
        } else {
            await expect(page.getByRole("button", { name: /Browse problems/ })).toBeVisible()
        }

        // The project's fallback rule: a block that would render empty shows
        // an honest alternative or does not render at all.
        await expect(page.getByText("0 lessons")).toHaveCount(0)
    })

    test("skipping completes and never redirects again", async ({ context, page }) => {
        const skipper = await seedUser({ email: `${PREFIX}-skip@example.test` })
        emails.push(`${PREFIX}-skip@example.test`)
        await prisma.user.update({
            where: { id: skipper.id },
            data: { onboardingCompletedAt: null, sqlLevel: null },
        })

        await context.addCookies([sessionCookie(skipper.sessionToken, BASE_URL)])
        await page.goto(`${BASE_URL}/welcome`)
        await page.getByRole("button", { name: "Skip" }).click()

        await expect(page).toHaveURL(new RegExp(`${BASE_URL}/?$`))

        const stored = await prisma.user.findUnique({
            where: { id: skipper.id },
            select: { sqlLevel: true, onboardingCompletedAt: true },
        })
        // Skipped: completed, but no level. That pair is what the skip-rate
        // tile counts.
        expect(stored?.sqlLevel).toBeNull()
        expect(stored?.onboardingCompletedAt).not.toBeNull()

        await page.goto(`${BASE_URL}/`)
        await expect(page).not.toHaveURL(/\/welcome/)
    })
})
