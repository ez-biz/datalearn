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

test.describe("workspace pass rate", () => {
    const RATE_EMAIL = "e2e-sp5-passrate@example.test"

    test("shows a rate when there are attempts and nothing when there are none", async ({
        page,
    }) => {
        const user = await seedUser({ email: RATE_EMAIL })
        const problem = await prisma.sQLProblem.findUnique({
            where: { slug: SLUG },
            select: { id: true, attemptCount: true, acceptedCount: true },
        })
        if (!problem) throw new Error(`${SLUG} is not seeded`)

        // One accepted, two wrong -> 33%. Seeded here rather than relying on
        // whatever submissions the environment happens to have.
        for (const ok of [true, false, false]) {
            await prisma.$transaction([
                prisma.submission.create({
                    data: {
                        userId: user.id,
                        problemId: problem.id,
                        status: ok ? "ACCEPTED" : "WRONG_ANSWER",
                        code: "SELECT 1;",
                    },
                }),
                prisma.sQLProblem.update({
                    where: { id: problem.id },
                    data: {
                        attemptCount: { increment: 1 },
                        acceptedCount: { increment: ok ? 1 : 0 },
                    },
                }),
            ])
        }

        try {
            await page.goto(`/practice/${SLUG}`)
            const expected = Math.round(
                ((problem.acceptedCount + 1) / (problem.attemptCount + 3)) * 100
            )
            await expect(page.getByText(`${expected}% pass`)).toBeVisible()
        } finally {
            // Deleting the user cascades the submissions but does NOT
            // decrement the counters, so restore them explicitly.
            await deleteUser(RATE_EMAIL)
            await prisma.sQLProblem.update({
                where: { id: problem.id },
                data: {
                    attemptCount: problem.attemptCount,
                    acceptedCount: problem.acceptedCount,
                },
            })
        }
    })

    test("renders no chip for a problem nobody has attempted", async ({ page }) => {
        const fresh = await prisma.sQLProblem.findFirst({
            where: { status: "PUBLISHED", attemptCount: 0 },
            select: { slug: true },
        })
        if (!fresh) throw new Error("no unattempted published problem to test")
        await page.goto(`/practice/${fresh.slug}`)
        await expect(page.getByText(/% pass/)).toHaveCount(0)
    })
})

test.describe("workspace community approaches", () => {
    const APPROACH_EMAIL = "e2e-sp5-approach@example.test"

    test("any signed-in user can share one, and it is marked unverified", async ({
        page,
        context,
        baseURL,
    }) => {
        const user = await seedUser({ email: APPROACH_EMAIL })
        await context.addCookies([sessionCookie(user.sessionToken, baseURL!)])
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/practice/${SLUG}`)
        await page.getByRole("tab", { name: "Solutions" }).click()

        await expect(
            page.getByText("Nobody has shared an approach yet.")
        ).toBeVisible()

        await page.getByLabel("Your approach").fill("SELECT id FROM users;")
        await page.getByLabel("Strategy").fill("plain select")
        await page.getByRole("button", { name: "Share" }).click()

        // Posting is open to anyone signed in; the mitigation is that an
        // author with no accepted submission is labelled, not blocked.
        await expect(page.getByText("plain select")).toBeVisible({
            timeout: 10_000,
        })
        await expect(
            page.getByText("Not verified against the expected output.")
        ).toBeVisible()

        // One per user: the composer is replaced once you have one.
        await expect(
            page.getByText("You have shared an approach for this problem.")
        ).toBeVisible()

        await deleteUser(APPROACH_EMAIL)
        await prisma.discussionComment.deleteMany({
            where: { kind: "APPROACH", userId: null },
        })
    })

    test("approaches never leak into the discussion thread", async ({
        page,
        context,
        baseURL,
    }) => {
        const user = await seedUser({ email: APPROACH_EMAIL })
        await context.addCookies([sessionCookie(user.sessionToken, baseURL!)])
        await page.goto(`/practice/${SLUG}`)
        await page.getByRole("tab", { name: "Solutions" }).click()
        await page.getByLabel("Your approach").fill("SELECT 1;")
        await page.getByRole("button", { name: "Share" }).click()
        await expect(page.getByText("SELECT 1;")).toBeVisible({ timeout: 10_000 })

        await page.getByRole("tab", { name: "Discussion" }).click()
        await expect(page.getByRole("tabpanel")).not.toContainText("SELECT 1;")

        await deleteUser(APPROACH_EMAIL)
        await prisma.discussionComment.deleteMany({
            where: { kind: "APPROACH", userId: null },
        })
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
