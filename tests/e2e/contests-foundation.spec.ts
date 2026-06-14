import { expect, test } from "@playwright/test"
import {
    deleteUser,
    prisma,
    sessionCookie,
    type SeededUser,
    seedUser,
} from "./fixtures/db"

const PREFIX = "e2e-contest-"
const CONTEST_SLUG = `${PREFIX}weekly-sql-contest`
const LEGACY_CONTEST_SLUG = "e2e-weekly-sql-contest"
const ADMIN_EMAIL = `${PREFIX}admin@example.test`
const LEARNER_EMAIL = `${PREFIX}learner@example.test`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

/** Format a Date as the `YYYY-MM-DDTHH:mm` value a datetime-local input expects. */
function toDateTimeLocal(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0")
    return (
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
        `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    )
}

let admin: SeededUser
let learner: SeededUser
let schemaId: string
let problemId: string
let problemSlug: string
let contestTitle: string

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()

    admin = await seedUser({ email: ADMIN_EMAIL, role: "ADMIN" })
    learner = await seedUser({ email: LEARNER_EMAIL })

    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}schema`,
            sql: "CREATE TABLE t (id INTEGER);",
        },
    })
    schemaId = schema.id

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 50_000,
            slug: `${PREFIX}problem`,
            title: "E2E Contest Locked Problem",
            description: "Contest problem description",
            schemaDescription: "Contest problem schema",
            schemaId,
            expectedOutput: "[]",
            expectedOutputs: { DUCKDB: "[]" },
            solutionSql: "SELECT 1;",
            solutions: { DUCKDB: "SELECT 1;" },
            difficulty: "EASY",
            status: "PUBLISHED",
            dialects: ["DUCKDB"],
        },
    })
    problemId = problem.id
    problemSlug = problem.slug
    contestTitle = "E2E Weekly SQL Contest"
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("admin creates a contest, attaches a problem, learner sees and registers", async ({
    browser,
}) => {
    const adminContext = await browser.newContext({
        baseURL: BASE_URL,
        storageState: {
            cookies: [sessionCookie(admin.sessionToken, BASE_URL)],
            origins: [],
        },
    })
    const adminPage = await adminContext.newPage()
    await adminPage.goto("/admin/contests/new")
    await adminPage.getByLabel("Title").fill(contestTitle)
    await adminPage.getByLabel("Slug").fill(CONTEST_SLUG)
    await adminPage
        .getByLabel("Description")
        .fill("A contest created through the admin UI.")
    // The contest must be SCHEDULED (start in the future) when we attach
    // problems and the learner registers — the attach API rejects any
    // non-SCHEDULED contest, and the practice-lockout / registration
    // assertions below also assume the contest hasn't ended. Compute the
    // window relative to now so the test never rots into a past date.
    const startsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const endsAt = new Date(startsAt.getTime() + 90 * 60 * 1000)
    await adminPage.getByLabel("Starts at").fill(toDateTimeLocal(startsAt))
    await adminPage.getByLabel("Ends at").fill(toDateTimeLocal(endsAt))
    await adminPage.getByRole("button", { name: /create contest/i }).click()
    await expect(adminPage).toHaveURL(/\/admin\/contests\/[^/]+$/)

    await adminPage.getByLabel("Problem").selectOption(problemId)
    await adminPage.getByLabel("Pos").fill("1")
    await adminPage.getByLabel("Pts").fill("3")
    // The attach POST persists the ContestProblem server-side (201); the
    // picker then calls router.refresh() to reflect it, but that refresh can
    // lag past the assertion window on a cold prod render. Wait for the POST
    // to complete, then reload to render the persisted state deterministically.
    const attachResponse = adminPage.waitForResponse(
        (res) =>
            res.url().includes("/problems") &&
            res.request().method() === "POST"
    )
    await adminPage.getByRole("button", { name: /attach/i }).click()
    await attachResponse
    await adminPage.reload()
    // Scope to the attached-problems list item, not a bare getByText: the bare
    // text also matches the (now-filtered) <option> in the picker.
    await expect(
        adminPage
            .getByRole("listitem")
            .filter({ hasText: "E2E Contest Locked Problem" })
    ).toBeVisible()

    await adminPage.goto("/practice")
    await expect(adminPage.getByText("E2E Contest Locked Problem")).toHaveCount(0)
    await adminPage.goto(`/practice/${problemSlug}`)
    // `.first()` guards against a transient duplicate match during App-Router
    // hydration; the lock banner renders once in the settled DOM.
    await expect(
        adminPage.getByText(/Locked: in contest until/i).first()
    ).toBeVisible()
    await adminContext.close()

    const learnerContext = await browser.newContext({
        baseURL: BASE_URL,
        storageState: {
            cookies: [sessionCookie(learner.sessionToken, BASE_URL)],
            origins: [],
        },
    })
    const learnerPage = await learnerContext.newPage()
    await learnerPage.goto("/contests")
    await expect(learnerPage.getByText(contestTitle).first()).toBeVisible()
    await learnerPage.getByText(contestTitle).first().click()
    await learnerPage.getByRole("button", { name: /^register$/i }).click()
    await expect(
        learnerPage.getByRole("button", { name: /registered/i })
    ).toBeVisible()
    await learnerContext.close()
})

async function cleanup() {
    const contestIds = (
        await prisma.contest.findMany({
            where: {
                OR: [
                    { slug: { startsWith: PREFIX } },
                    { slug: LEGACY_CONTEST_SLUG },
                ],
            },
            select: { id: true },
        })
    ).map((row) => row.id)
    const problemIds = (
        await prisma.sQLProblem.findMany({
            where: { slug: { startsWith: PREFIX } },
            select: { id: true },
        })
    ).map((row) => row.id)

    await prisma.contestProblemLock.deleteMany({
        where: {
            OR: [
                { contestId: { in: contestIds } },
                { problemId: { in: problemIds } },
            ],
        },
    })
    await prisma.contestProblem.deleteMany({
        where: {
            OR: [
                { contestId: { in: contestIds } },
                { problemId: { in: problemIds } },
            ],
        },
    })
    await prisma.contestRegistration.deleteMany({
        where: { contestId: { in: contestIds } },
    })
    await prisma.contest.deleteMany({
        where: { id: { in: contestIds } },
    })
    await prisma.sQLProblem.deleteMany({
        where: { slug: { startsWith: PREFIX } },
    })
    await prisma.sqlSchema.deleteMany({
        where: { name: { startsWith: PREFIX } },
    })
    await deleteUser(ADMIN_EMAIL)
    await deleteUser(LEARNER_EMAIL)
}
