import { expect, test } from "@playwright/test"
import {
    deleteUser,
    prisma,
    sessionCookie,
    type SeededUser,
    seedUser,
} from "./fixtures/db"

const PREFIX = "e2e-track-"
const USER_EMAIL = `${PREFIX}learner@example.test`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

let learner: SeededUser
let schemaId: string
let firstProblemSlug: string
let secondProblemSlug: string
let thirdProblemSlug: string
let publishedTrackSlug: string

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()

    learner = await seedUser({ email: USER_EMAIL })

    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}schema`,
            sql: "CREATE TABLE t (id INTEGER);",
        },
    })
    schemaId = schema.id

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    let next = (max._max.number ?? 0) + 40_000
    const baseProblem = {
        description: "E2E track problem description",
        schemaDescription: "E2E track schema description",
        schemaId,
        expectedOutput: "[]",
        status: "PUBLISHED" as const,
        dialects: ["DUCKDB" as const],
    }

    const firstProblem = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-1`,
            title: "E2E Track First Problem",
            difficulty: "EASY",
        },
    })
    const secondProblem = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-2`,
            title: "E2E Track Second Problem",
            difficulty: "MEDIUM",
        },
    })
    const thirdProblem = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: `${PREFIX}problem-3`,
            title: "E2E Track Third Problem",
            difficulty: "HARD",
        },
    })

    firstProblemSlug = firstProblem.slug
    secondProblemSlug = secondProblem.slug
    thirdProblemSlug = thirdProblem.slug
    publishedTrackSlug = `${PREFIX}published`

    await prisma.track.create({
        data: {
            slug: publishedTrackSlug,
            name: "E2E Published Track",
            summary: "A track that should be visible to learners.",
            description:
                "Work through the essentials in order, then use the final item as a review checkpoint.",
            difficulty: "MIXED",
            status: "PUBLISHED",
            estimatedMinutes: 75,
            createdAt: new Date("2026-05-10T00:00:00.000Z"),
            items: {
                create: [
                    { problemId: firstProblem.id, position: 0 },
                    { problemId: secondProblem.id, position: 1 },
                    { problemId: thirdProblem.id, position: 2 },
                ],
            },
        },
    })

    await prisma.track.create({
        data: {
            slug: `${PREFIX}draft`,
            name: "E2E Draft Track",
            summary: "This track should stay hidden.",
            description: "Hidden draft body.",
            status: "DRAFT",
            items: {
                create: [{ problemId: firstProblem.id, position: 0 }],
            },
        },
    })

    await prisma.submission.create({
        data: {
            userId: learner.id,
            problemId: firstProblem.id,
            status: "ACCEPTED",
            code: "SELECT 1;",
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test.describe("Tracks learner pages", () => {
    test("public index lists published tracks with counts and hides drafts", async ({
        page,
    }) => {
        await page.goto("/learn/tracks")

        await expect(
            page.getByRole("heading", { name: "Tracks" }),
        ).toBeVisible()
        await expect(page.getByText("E2E Published Track")).toBeVisible()
        await expect(
            page.getByText("A track that should be visible to learners."),
        ).toBeVisible()
        await expect(page.getByText("3 problems")).toBeVisible()
        await expect(page.getByText("E2E Draft Track")).toHaveCount(0)
    })

    test("detail page shows ordered items and start link", async ({ page }) => {
        await page.goto(`/learn/tracks/${publishedTrackSlug}`)

        await expect(
            page.getByRole("heading", { name: "E2E Published Track" }),
        ).toBeVisible()
        await expect(
            page.getByRole("link", { name: /start/i }),
        ).toHaveAttribute("href", `/practice/${firstProblemSlug}`)

        const items = page.getByTestId("track-item")
        await expect(items).toHaveCount(3)
        await expect(items.nth(0)).toContainText("E2E Track First Problem")
        await expect(items.nth(1)).toContainText("E2E Track Second Problem")
        await expect(items.nth(2)).toContainText("E2E Track Third Problem")
    })

    test("unknown track slug renders not found", async ({ page }) => {
        await page.goto("/learn/tracks/not-a-real-track")

        await expect(
            page.getByRole("heading", { name: /page not found/i }),
        ).toBeVisible()
    })

    test("signed-in learner sees progress and continue points to the next unsolved item", async ({
        browser,
    }) => {
        const context = await browser.newContext({
            baseURL: BASE_URL,
            storageState: {
                cookies: [sessionCookie(learner.sessionToken, BASE_URL)],
                origins: [],
            },
        })
        const page = await context.newPage()

        await page.goto(`/learn/tracks/${publishedTrackSlug}`)

        // `.first()` throughout: the App-Router hydration/streaming pass can
        // briefly render a second copy of these elements, so an un-scoped
        // locator strict-mode-violates on the transient duplicate. The settled
        // DOM renders each once.
        await expect(page.getByText("1 / 3 complete").first()).toBeVisible()
        await expect(
            page.getByTestId(`track-item-${firstProblemSlug}`).first(),
        ).toContainText("Solved")
        await expect(
            page.getByRole("link", { name: /continue/i }).first(),
        ).toHaveAttribute("href", `/practice/${secondProblemSlug}`)
        await expect(
            page.getByTestId(`track-item-${thirdProblemSlug}`).first(),
        ).toContainText("Queued")

        await context.close()
    })
})

async function cleanup() {
    await prisma.submission.deleteMany({
        where: { user: { email: { startsWith: PREFIX } } },
    })
    await prisma.track.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
    await deleteUser(USER_EMAIL)
}
