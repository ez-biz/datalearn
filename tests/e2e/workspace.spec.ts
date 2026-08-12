import { test, expect, type Page } from "@playwright/test"
import { prisma, seedUser, deleteUser, sessionCookie } from "./fixtures/db"

// Workspace behaviour that the shell suite (workspace-shell.spec.ts) does
// not cover: solution gating, the first-visit collapsible rule, and panel
// persistence.
//
// The gating tests are the important ones. getProblemSolution enforces the
// rule server-side regardless of what the tab renders, but a UI that offers
// a reveal button to someone who cannot use it — or worse, stops offering it
// to someone who can — is its own bug.

const SLUG = "simple-select"
const UNSOLVED_EMAIL = "e2e-sp5-solutions-unsolved@example.test"
const SOLVED_EMAIL = "e2e-sp5-solutions-solved@example.test"

async function solutionsTabText(page: Page): Promise<string> {
    await page.goto(`/practice/${SLUG}`)
    await page.getByRole("tab", { name: "Solutions" }).click()
    await page.waitForTimeout(400)
    return page.getByRole("tabpanel").innerText()
}

test.describe("workspace solutions gating", () => {
    test("anonymous viewers get the sign-in nudge, never a reveal button", async ({
        page,
    }) => {
        const text = await solutionsTabText(page)
        expect(text).toContain("Sign in to see the canonical solution")
        expect(text).not.toContain("Reveal solution")
    })

    test("signed in but unsolved gets the locked state", async ({
        page,
        context,
        baseURL,
    }) => {
        const user = await seedUser({ email: UNSOLVED_EMAIL })
        await context.addCookies([sessionCookie(user.sessionToken, baseURL!)])
        const text = await solutionsTabText(page)
        expect(text).toContain("Solve it first")
        expect(text).not.toContain("Reveal solution")
        await deleteUser(UNSOLVED_EMAIL)
    })

    test("an accepted submission unlocks a deliberate reveal", async ({
        page,
        context,
        baseURL,
    }) => {
        const user = await seedUser({ email: SOLVED_EMAIL })
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug: SLUG },
            select: { id: true },
        })
        if (!problem) throw new Error(`${SLUG} is not seeded`)
        await prisma.submission.create({
            data: {
                userId: user.id,
                problemId: problem.id,
                status: "ACCEPTED",
                code: "SELECT 1;",
            },
        })
        await context.addCookies([sessionCookie(user.sessionToken, baseURL!)])
        const text = await solutionsTabText(page)
        // Revealed only on a press — never automatically.
        expect(text).toContain("Reveal solution")
        expect(text).not.toContain("SELECT")
        await deleteUser(SOLVED_EMAIL)
    })
})

test.describe("workspace description tab", () => {
    test("schema is open on a first visit and collapsed on the next", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/practice/${SLUG}`)
        await page.waitForTimeout(600)
        const schema = page.getByRole("button", { name: /schema/i }).first()
        await expect(schema).toHaveAttribute("aria-expanded", "true")

        await page.reload()
        await page.waitForTimeout(600)
        await expect(
            page.getByRole("button", { name: /schema/i }).first()
        ).toHaveAttribute("aria-expanded", "false")
    })
})

test.describe("workspace problems panel", () => {
    test("closing the panel survives a reload", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/practice/${SLUG}`)
        const panel = page.getByRole("complementary", { name: "All problems" })
        await expect(panel).toBeVisible()

        await page.getByRole("button", { name: "Close problems panel" }).click()
        await expect(panel).toHaveCount(0)

        await page.reload()
        await page.waitForTimeout(600)
        await expect(
            page.getByRole("complementary", { name: "All problems" })
        ).toHaveCount(0)

        // And the reopen affordance is present, so closing is not a one-way door.
        await page.getByRole("button", { name: "Open problems panel" }).click()
        await expect(
            page.getByRole("complementary", { name: "All problems" })
        ).toBeVisible()
    })
})
