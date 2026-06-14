import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

const PREFIX = "e2e-custom-"
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

    // Schema carries sample data so the in-browser query returns rows.
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}schema`,
            sql: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1), (2);",
        },
    })
    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (max._max.number ?? 0) + 70_000,
            slug: `${PREFIX}problem`,
            title: "E2E Custom Problem",
            description: "Return x ordered.",
            schemaDescription: "One table t(x).",
            schemaId: schema.id,
            status: "PUBLISHED",
            difficulty: "EASY",
            dialects: ["DUCKDB"],
            ordered: true,
            // Custom contests judge practice-style against the PUBLIC expected
            // output (NOT hidden data). submitCustomContestEntry reads
            // expectedOutputs[dialect] as a JSON STRING and falls back to the
            // legacy expectedOutput field — both set here.
            expectedOutput: '[{"x":1},{"x":2}]',
            expectedOutputs: { DUCKDB: '[{"x":1},{"x":2}]' },
            solutionSql: "SELECT x FROM t ORDER BY x",
            solutions: { DUCKDB: "SELECT x FROM t ORDER BY x" },
        },
    })
    problemSlug = problem.slug

    // LIVE USER_CUSTOM contest: the stored status is "SCHEDULED" but
    // deriveContestStatus derives LIVE from the time window (past start +
    // future end), so the play page is in PLAY mode and standings render.
    // Custom contests are register-free, so no ContestRegistration row.
    await prisma.contest.create({
        data: {
            slug: SLUG,
            title: "E2E Custom Contest",
            description: "Custom contest e2e.",
            kind: "USER_CUSTOM",
            status: "SCHEDULED",
            visibility: "PUBLIC",
            rated: false,
            createdById: player.id,
            startsAt: new Date(Date.now() - 60 * 60 * 1000),
            endsAt: new Date(Date.now() + 60 * 60 * 1000),
            durationMinutes: 120,
            maxParticipants: 20,
            problems: {
                create: [{ problemId: problem.id, position: 0, points: 1 }],
            },
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("signed-in user plays a custom contest and lands on the standings", async ({
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
    await page.goto(`/contests/custom/${SLUG}/${problemSlug}`)

    // Type the known-correct SQL into the Monaco editor. Click the editor
    // container (not the hidden textarea) once it has mounted, then type.
    const editor = page.locator(".monaco-editor").first()
    await editor.waitFor({ state: "visible" })
    await editor.click()
    // insertText (atomic) instead of type() — per-keystroke typing intermittently
    // drops characters / triggers Monaco autocomplete on CI, corrupting the SQL
    // (observed: "SELECT x FROM t..." became "SELECT x ORDER BY x").
    await page.keyboard.insertText("SELECT x FROM t ORDER BY x")

    // PRACTICE judging runs the query in-browser before submitting, so the
    // DuckDB-WASM engine must finish loading first. The Run button is disabled
    // (`runDisabled={!ready}`) until then, so its enabled state is our signal
    // the engine is ready — otherwise submit fails with "Database is not ready
    // yet." (the Submit button itself isn't gated on engine readiness).
    await expect(page.getByTestId("workspace-run-editor")).toBeEnabled({
        timeout: 60_000,
    })

    // The Submit button enables only once the SQL state is populated, so this
    // also confirms the keystrokes reached React state.
    const submitButton = page.getByRole("button", {
        name: /submit to contest/i,
    })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()

    await expect(page.getByText(/Accepted/i).first()).toBeVisible({
        timeout: 60_000,
    })

    // Standings now list the player on the custom-contest detail page.
    await page.goto(`/contests/custom/${SLUG}`)
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
    await prisma.submission.deleteMany({
        where: { user: { email: { startsWith: PREFIX } } },
    })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}
