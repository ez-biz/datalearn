import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

const PREFIX = "e2e-play-"
const SLUG = `${PREFIX}contest`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

let player: SeededUser
let problemSlug: string

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()
    player = await seedUser({
        email: `${PREFIX}player@example.test`,
        name: "Player",
    })

    const schema = await prisma.sqlSchema.create({
        data: { name: `${PREFIX}schema`, sql: "CREATE TABLE t (x INT);" },
    })
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 60_000,
            slug: `${PREFIX}problem`,
            title: "E2E Play Problem",
            description: "Return x ordered.",
            schemaDescription: "One table t(x).",
            schemaId: schema.id,
            status: "PUBLISHED",
            difficulty: "EASY",
            dialects: ["DUCKDB"],
            expectedOutput: "[]",
            expectedOutputs: { DUCKDB: "[]" },
            solutionSql: "SELECT x FROM t ORDER BY x",
            solutions: { DUCKDB: "SELECT x FROM t ORDER BY x" },
            // Hidden data the server judge runs against.
            hiddenSchemas: {
                DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1), (2);",
            },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 1 }, { x: 2 }] },
        },
    })
    problemSlug = problem.slug

    // LIVE contest: status is derived from the time window by
    // deriveContestStatus (past start + future end => LIVE), regardless of the
    // stored "SCHEDULED" status — so the play page is in PLAY mode.
    const contest = await prisma.contest.create({
        data: {
            slug: SLUG,
            title: "E2E Play Contest",
            description: "Play e2e.",
            kind: "WEEKLY",
            status: "SCHEDULED",
            visibility: "PUBLIC",
            startsAt: new Date(Date.now() - 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 60 * 60 * 1000),
            durationMinutes: 120,
            rated: false,
            createdById: player.id,
            problems: {
                create: [{ problemId: problem.id, position: 1, points: 3 }],
            },
        },
    })
    await prisma.contestRegistration.create({
        data: { contestId: contest.id, userId: player.id },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("registered player submits a correct solution and sees Accepted", async ({
    browser,
}) => {
    const context = await browser.newContext({
        baseURL: BASE_URL,
        storageState: {
            cookies: [sessionCookie(player.sessionToken, BASE_URL)],
            origins: [],
        },
    })
    const page = await context.newPage()
    await page.goto(`/contests/${SLUG}/${problemSlug}`)

    // Type the known-correct SQL into the Monaco editor. Click the editor
    // container (not the hidden textarea) once it has mounted, then type.
    const editor = page.locator(".monaco-editor").first()
    await editor.waitFor({ state: "visible" })
    await editor.click()
    await page.keyboard.type("SELECT x FROM t ORDER BY x")

    // The Submit button enables only once the SQL state is populated, so this
    // also confirms the keystrokes reached React state.
    const submitButton = page.getByRole("button", {
        name: /submit to contest/i,
    })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()

    await expect(page.getByText(/Accepted/i).first()).toBeVisible({
        timeout: 30_000,
    })

    // Leaderboard now lists the player on the contest page.
    await page.goto(`/contests/${SLUG}`)
    await expect(
        page.getByRole("heading", { name: "Standings", exact: true })
    ).toBeVisible()
    await expect(page.locator("tbody tr")).toContainText(["You"])

    await context.close()
})

async function cleanup() {
    const ids = (
        await prisma.contest.findMany({
            where: { slug: { startsWith: PREFIX } },
            select: { id: true },
        })
    ).map((c) => c.id)
    await prisma.contestProblemSolve.deleteMany({
        where: { contestId: { in: ids } },
    })
    await prisma.contestSubmission.deleteMany({
        where: { contestId: { in: ids } },
    })
    await prisma.contestLeaderboardEntry.deleteMany({
        where: { contestId: { in: ids } },
    })
    await prisma.contestProblem.deleteMany({ where: { contestId: { in: ids } } })
    await prisma.contestRegistration.deleteMany({
        where: { contestId: { in: ids } },
    })
    await prisma.contest.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}
