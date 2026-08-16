import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

/**
 * The admin problems list (`/admin/problems`) — `ProblemsListClient`'s
 * search input + status segmented control, both filtering client-side over
 * the already-loaded rows via the pure `filterProblems` (lib/admin/problems-filter.ts).
 *
 * Two fixture problems, PROBLEM_A and PROBLEM_B, share nothing but the run's
 * PREFIX (which lives only in their slugs, not their titles): PROBLEM_A is
 * titled "Zqxvorlin Klorbeth" / PUBLISHED, PROBLEM_B is "Zqxvorlin Dravnix" /
 * DRAFT. Both title suffixes ("Klorbeth", "Dravnix") are invented words
 * chosen to appear nowhere else — not in any ambient problem title (checked
 * against the local seed set: all plain-English titles like "Simple Select"),
 * not in this file's own UI-chrome matchers ("All"/"Draft"/"Published"/
 * "Clear filters"/"No problems match your filters"), and not substrings of
 * each other — so a search for one can never accidentally include the other,
 * the exact collision this sub-project has already hit once (a fixture title
 * containing "Overview" matching an unrelated section filter in
 * admin-overview.spec.ts).
 *
 * All row assertions are scoped to `main#main-content`'s row list
 * (`ul.divide-y > li`), never the page as a whole, and status-pill / segmented
 * -control assertions use exact-name `role="button"` locators — the row's own
 * status pill renders as a plain (non-interactive) `<span>` with a lowercase
 * label ("draft"), so it can never satisfy a `role: "button", name: "Draft"`
 * query even without the exact-case distinction.
 *
 * Non-vacuity: verified by breaking `filterProblems` to `return problems`
 * unconditionally — every narrowing test failed (both rows stayed visible /
 * the empty-state test found a full grid instead), then reverted. See the
 * task report for the exact diff and failure output.
 */
const NAMESPACE = "e2e-admin-problems"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`

const TITLE_A = "Zqxvorlin Klorbeth"
const SLUG_A = `${PREFIX}-klorbeth`
const TITLE_B = "Zqxvorlin Dravnix"
const SLUG_B = `${PREFIX}-dravnix`

// Guaranteed to match neither fixture: it carries the whole run PREFIX (so
// it can't collide with ambient data from another run) plus a suffix neither
// SLUG_A nor SLUG_B nor either title contains.
const NO_MATCH_QUERY = `${PREFIX}-nomatch-zzz`

let admin: SeededUser

test.describe.configure({ mode: "serial" })

async function cleanup(): Promise<void> {
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()

    admin = await seedUser({
        email: adminEmail,
        role: "ADMIN",
        name: "E2E Admin Problems Admin",
    })

    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}-schema`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })

    const maxNumber = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const base = (maxNumber._max.number ?? 0) + 98_001

    await prisma.sQLProblem.create({
        data: {
            number: base,
            title: TITLE_A,
            slug: SLUG_A,
            difficulty: "EASY",
            status: "PUBLISHED",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId: schema.id,
            expectedOutput: JSON.stringify([{ id: 1 }]),
            solutionSql: "SELECT id FROM t",
        },
    })
    await prisma.sQLProblem.create({
        data: {
            number: base + 1,
            title: TITLE_B,
            slug: SLUG_B,
            difficulty: "EASY",
            status: "DRAFT",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId: schema.id,
            expectedOutput: JSON.stringify([{ id: 1 }]),
            solutionSql: "SELECT id FROM t",
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
})

test("typing in the search narrows the visible rows", async ({ page }) => {
    await page.goto("/admin/problems")

    const main = page.locator("main#main-content")
    const rows = main.locator("ul.divide-y > li")

    // Sanity: both fixtures start out visible before any filter is applied.
    await expect(rows.filter({ hasText: TITLE_A })).toHaveCount(1)
    await expect(rows.filter({ hasText: TITLE_B })).toHaveCount(1)

    await page.getByLabel("Search problems").fill("Klorbeth")

    await expect(rows.filter({ hasText: TITLE_A })).toHaveCount(1)
    await expect(rows.filter({ hasText: TITLE_B })).toHaveCount(0)
})

test("the status filter narrows them", async ({ page }) => {
    await page.goto("/admin/problems")

    const main = page.locator("main#main-content")
    const rows = main.locator("ul.divide-y > li")
    const statusGroup = main.getByRole("group", { name: "Filter by status" })

    await statusGroup.getByRole("button", { name: "Draft", exact: true }).click()

    // PROBLEM_B is DRAFT, PROBLEM_A is PUBLISHED — the status control alone
    // (no search query) must narrow to just the draft one.
    await expect(rows.filter({ hasText: TITLE_B })).toHaveCount(1)
    await expect(rows.filter({ hasText: TITLE_A })).toHaveCount(0)
})

test("a query matching nothing shows the honest empty state, not the full list", async ({
    page,
}) => {
    await page.goto("/admin/problems")

    const main = page.locator("main#main-content")
    const rows = main.locator("ul.divide-y > li")

    // Sanity: the table is non-empty and both fixtures are present before
    // the no-match query is typed — otherwise the empty-state assertions
    // below would be trivially true for the wrong reason (nothing to hide).
    await expect(rows.filter({ hasText: TITLE_A })).toHaveCount(1)
    await expect(rows.filter({ hasText: TITLE_B })).toHaveCount(1)

    await page.getByLabel("Search problems").fill(NO_MATCH_QUERY)

    // The honest empty state, not a silently-empty grid: the EmptyState
    // heading renders, and — this is the part a "fall back to everything on
    // a miss" bug would fail — the row list itself has zero children, not
    // the unfiltered count, and neither fixture is anywhere on the page.
    await expect(
        main.getByRole("heading", { level: 3, name: "No problems match your filters" })
    ).toBeVisible()
    await expect(rows).toHaveCount(0)
    await expect(rows.filter({ hasText: TITLE_A })).toHaveCount(0)
    await expect(rows.filter({ hasText: TITLE_B })).toHaveCount(0)

    // The "N of M" readout is rendered unconditionally above the table (see
    // ProblemsListClient.tsx), so it directly disproves a fallback-to-full
    // -list bug: such a bug would render "M of M" here, never "0 of M".
    await expect(main.getByText(/^0 of \d+$/)).toBeVisible()
})

test("clearing restores the full list", async ({ page }) => {
    await page.goto("/admin/problems")

    const main = page.locator("main#main-content")
    const rows = main.locator("ul.divide-y > li")
    const search = page.getByLabel("Search problems")
    const statusGroup = main.getByRole("group", { name: "Filter by status" })

    // Compound-filter down to zero results: filterProblems ANDs the two
    // conditions, so search "Klorbeth" (title-matches only PROBLEM_A) plus
    // status Draft (PROBLEM_A is PUBLISHED, so status alone excludes it)
    // excludes PROBLEM_A via status and PROBLEM_B via the search text —
    // nothing is left standing from either fixture.
    await search.fill("Klorbeth")
    await statusGroup.getByRole("button", { name: "Draft", exact: true }).click()

    await expect(
        main.getByRole("heading", { level: 3, name: "No problems match your filters" })
    ).toBeVisible()
    await expect(rows).toHaveCount(0)

    await main.getByRole("button", { name: "Clear filters" }).click()

    // Both controls reset...
    await expect(search).toHaveValue("")
    await expect(
        statusGroup.getByRole("button", { name: "All", exact: true })
    ).toHaveAttribute("aria-pressed", "true")

    // ...and, the part that actually proves the list came back: both
    // fixtures are visible again, including the one status alone had
    // excluded and the one search alone had excluded.
    await expect(rows.filter({ hasText: TITLE_A })).toHaveCount(1)
    await expect(rows.filter({ hasText: TITLE_B })).toHaveCount(1)
})
