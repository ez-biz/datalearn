import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

/**
 * The analytics portal (`/admin/analytics`, V11 phase 2).
 *
 * Two things are worth testing end-to-end here, and neither is covered by
 * the pure unit suites:
 *
 * 1. **It is ADMIN-only.** Platform-wide user metrics are a different trust
 *    level from the discussion queue a MODERATOR is scoped to.
 *
 *    Two independent layers enforce this: `middleware.ts` narrows MODERATOR
 *    to `/admin/discussions*`, and `app/admin/analytics/page.tsx` calls
 *    `requireAdminPage()` rather than `requireAdminOrModeratorPage()`. Tests
 *    1 and 2 assert the *outcome* — the page is not served — and therefore
 *    guard the property rather than either layer individually.
 *
 *    This was measured, not assumed: loosening the page guard alone leaves
 *    the tests green (middleware still refuses), and loosening middleware
 *    alone likewise (the page guard still refuses). The moderator test only
 *    fails when BOTH are broken together. So do not read a green run here as
 *    proof that either mechanism is individually intact.
 *
 * 2. **Retention reports "not enough history yet" rather than 0%.** This is
 *    the honesty requirement from the design's §8, and it is deterministic
 *    here for a reason: the fixture users below are created *now*, so their
 *    D7 and D30 buckets provably cannot have elapsed. A regression that
 *    conflated "unknowable" with "nobody returned" would render 0% and fail
 *    this test.
 *
 * Deliberately NOT asserted: sign-up counts, acceptance rate, or the funnel
 * empty state. Those are global unscoped aggregates over a 30-day window, and
 * this file's own fixture users land inside that window — so any assertion on
 * them would be testing other specs' leftovers as much as this page.
 */
const NAMESPACE = "e2e-admin-analytics"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`
const moderatorEmail = `${PREFIX}-moderator@example.test`
const learnerEmail = `${PREFIX}-learner@example.test`

let admin: SeededUser
let moderator: SeededUser
let learner: SeededUser

/** Attempted once and never solved — its row must show a real 0%. */
const attemptedSlug = `${PREFIX}-attempted`
/** Never attempted — its row must show an em dash, never 0%. */
const untriedSlug = `${PREFIX}-untried`
const ATTEMPTED_TITLE = "E2E Analytics Attempted Problem"
const UNTRIED_TITLE = "E2E Analytics Untried Problem"

test.describe.configure({ mode: "serial" })

async function cleanup(): Promise<void> {
    // Submissions reference both problems and users, so they go first.
    await prisma.submission.deleteMany({
        where: { problem: { slug: { startsWith: PREFIX } } },
    })
    await prisma.moderatorPermission.deleteMany({
        where: { user: { email: { startsWith: PREFIX } } },
    })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()
    ;[admin, moderator, learner] = await Promise.all([
        seedUser({ email: adminEmail, role: "ADMIN", name: "E2E Analytics Admin" }),
        seedUser({
            email: moderatorEmail,
            role: "MODERATOR",
            name: "E2E Analytics Moderator",
        }),
        seedUser({ email: learnerEmail, role: "USER", name: "E2E Analytics Learner" }),
    ])

    // Granted so test 2 fails for the right reason. Without it the moderator
    // couldn't reach any /admin route at all, and the test would be
    // exercising a generic permission check rather than proving that
    // analytics specifically excludes an otherwise-capable moderator.
    await prisma.moderatorPermission.create({
        data: {
            userId: moderator.id,
            permission: "VIEW_DISCUSSION_QUEUE",
            grantedById: admin.id,
        },
    })

    // Two problems and exactly one submission, so the content table's
    // behaviour is deterministic regardless of what else the database holds:
    // the submission guarantees the table renders at all (it is replaced by a
    // zero-state when nothing has ever been attempted), and the untried
    // problem guarantees there is a row whose acceptance is genuinely unknown.
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}-schema`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })
    const maxNumber = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const baseNumber = (maxNumber._max.number ?? 0) + 94_001

    const [attempted] = await Promise.all([
        prisma.sQLProblem.create({
            data: {
                number: baseNumber,
                title: ATTEMPTED_TITLE,
                slug: attemptedSlug,
                difficulty: "EASY",
                status: "PUBLISHED",
                description: "Return one row.",
                schemaDescription: "One table.",
                schemaId: schema.id,
                expectedOutput: JSON.stringify([{ id: 1 }]),
                solutionSql: "SELECT id FROM t",
            },
        }),
        prisma.sQLProblem.create({
            data: {
                number: baseNumber + 1,
                title: UNTRIED_TITLE,
                slug: untriedSlug,
                difficulty: "EASY",
                status: "PUBLISHED",
                description: "Return one row.",
                schemaDescription: "One table.",
                schemaId: schema.id,
                expectedOutput: JSON.stringify([{ id: 1 }]),
                solutionSql: "SELECT id FROM t",
            },
        }),
    ])

    await prisma.submission.create({
        data: {
            userId: learner.id,
            problemId: attempted.id,
            status: "WRONG_ANSWER",
            code: "SELECT 1;",
            reason: "Row count mismatch — got 0, expected 1.",
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("a signed-in USER is refused", async ({ page }) => {
    await page.context().addCookies([sessionCookie(learner.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    await expect(page).not.toHaveURL(/\/admin\/analytics/)
    await expect(
        page.getByRole("heading", { name: "Analytics", level: 1 })
    ).toHaveCount(0)
})

test("a MODERATOR with discussion permission is still refused", async ({ page }) => {
    await page.context().addCookies([sessionCookie(moderator.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    await expect(page).not.toHaveURL(/\/admin\/analytics/)
    await expect(
        page.getByRole("heading", { name: "Analytics", level: 1 })
    ).toHaveCount(0)
})

test("an ADMIN sees every section render", async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    await expect(page).toHaveURL(/\/admin\/analytics/)
    await expect(page.getByRole("heading", { name: "Analytics", level: 1 })).toBeVisible()

    // Each section is its own labelled region; a read that threw would drop
    // its section rather than rendering an empty one.
    for (const heading of [
        "Platform",
        "Active learners",
        "New-user funnel",
        "Retention",
    ]) {
        await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible()
    }
})

test("a cohort too young for its bucket reads as unknown, not as zero", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    // The fixture users signed up moments ago, so today's cohort appears in
    // the D30 table and its bucket day is 30 days away. The only honest
    // answer is that it is not yet knowable.
    const d30 = page.getByRole("table", { name: /D30 retention/ })
    await expect(d30).toBeVisible()

    // Anchor to today's cohort row specifically. Asserting on the table as a
    // whole would pass on any other cohort's copy; asserting the absence of
    // "0%" would pass vacuously, because that text is a bare node inside a
    // cell reading "0% (0 of 1)" and matches no element exactly.
    const todayKey = new Date().toISOString().slice(0, 10)
    const todayRow = d30.locator("tr").filter({ hasText: todayKey })
    await expect(todayRow).toHaveCount(1)
    await expect(todayRow).toContainText("Not enough history yet")
})

test("the content sections render for an ADMIN", async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    for (const heading of ["Problem performance", "Track completion"]) {
        await expect(page.getByRole("heading", { name: heading, level: 2 })).toBeVisible()
    }
})

test("an untried problem reads as unknown, while an attempted-and-unsolved one reads as a real zero", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    const table = page.getByRole("table", { name: /Per-problem acceptance/ })
    await expect(table).toBeVisible()

    // Attempted once, never solved: 0% is the true answer and must be shown
    // with its denominator rather than hidden behind a dash.
    const attemptedRow = table.locator("tr").filter({ hasText: ATTEMPTED_TITLE })
    await expect(attemptedRow).toHaveCount(1)
    await expect(attemptedRow).toContainText("0%")
    await expect(attemptedRow).toContainText("(0 of 1)")

    // Never attempted: there is no rate to report. Rendering 0% here would
    // claim the problem is unsolvable when nobody has tried it, and would
    // also sort it to the top of a table meant to surface broken problems.
    const untriedRow = table.locator("tr").filter({ hasText: UNTRIED_TITLE })
    await expect(untriedRow).toHaveCount(1)
    await expect(untriedRow).not.toContainText("%")
    await expect(untriedRow).toContainText("—")
})

test("the drift indicator always states a result, never stays silent", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin/analytics")

    // Zero drift is a checked result, not an absence — the component must
    // say one or the other, because silence is indistinguishable from
    // "we never looked".
    const inSync = page.getByText(/Pass-rate counters match submission history/)
    const drifted = page.getByText(/problems have drifted pass-rate counters/)
    await expect(inSync.or(drifted)).toBeVisible()
})

test("a non-admin is refused the per-problem drill-down too", async ({ page }) => {
    await page.context().addCookies([sessionCookie(learner.sessionToken, BASE_URL)])
    await page.goto(`/admin/analytics/problems/${attemptedSlug}`)

    await expect(page).not.toHaveURL(/\/admin\/analytics\/problems/)

    // Assert on content unique to the drill-down, NOT on the problem title:
    // the redirect lands on a public page where a PUBLISHED problem's title
    // legitimately appears, so a title check would fail on correct behaviour.
    await expect(
        page.getByRole("heading", { name: "Why submissions failed" })
    ).toHaveCount(0)
    await expect(
        page.getByRole("heading", { name: "Attempts before solving" })
    ).toHaveCount(0)
})

test("the drill-down classifies the failure and still shows the empty categories", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto(`/admin/analytics/problems/${attemptedSlug}`)

    await expect(
        page.getByRole("heading", { level: 1, name: new RegExp(ATTEMPTED_TITLE) })
    ).toBeVisible()

    // The fixture's single failure is "Row count mismatch — got 0, expected 1.",
    // which the taxonomy maps to ROW_COUNT. Asserting the label AND the share
    // proves the classifier ran, rather than that some text happens to exist.
    const rowCount = page.locator("li").filter({ hasText: "Wrong number of rows" })
    await expect(rowCount).toContainText("1")
    await expect(rowCount).toContainText("100%")

    // Categories with no occurrences must still render. Dropping them would
    // read as "this never happens", and would hide a rising Unclassified
    // share — which is how a changed validator message announces itself.
    for (const label of ["Wrong columns", "Wrong values", "Unclassified"]) {
        await expect(page.locator("li").filter({ hasText: label })).toHaveCount(1)
    }
})

test("a problem with no submissions says so instead of reporting 0%", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto(`/admin/analytics/problems/${untriedSlug}`)

    await expect(
        page.getByRole("heading", { level: 1, name: new RegExp(UNTRIED_TITLE) })
    ).toBeVisible()
    await expect(page.getByText(/No submissions for this problem yet/)).toBeVisible()

    // The failure mode: an acceptance rate of 0% on a problem nobody has
    // attempted reads as "unsolvable" rather than "untried".
    await expect(page.getByText("0%")).toHaveCount(0)
})

test("an unknown problem slug renders not-found, not an empty shell", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto(`/admin/analytics/problems/${PREFIX}-does-not-exist`)

    // Asserts the rendered not-found UI rather than a 404 status code: this
    // app answers notFound() with HTTP 200 throughout (verified against
    // /practice/<missing>, which calls notFound() and also returns 200), so a
    // status assertion here would invent a convention the codebase does not
    // follow and would fail for reasons unrelated to this page.
    await expect(
        page.getByRole("heading", { name: "Page not found", level: 1 })
    ).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "Why submissions failed" })
    ).toHaveCount(0)
})
