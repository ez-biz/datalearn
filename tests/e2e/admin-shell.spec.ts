import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

/**
 * The admin shell — the grouped sidebar `ConsoleAdminSidebar` renders in
 * place of the learner `ConsoleSidebar` on `/admin/*` routes (see
 * `ConsoleChrome.tsx`), driven by `visibleAdminNav` (lib/admin/admin-nav-model.ts).
 *
 * The security-relevant case is role filtering: a MODERATOR must never
 * receive ADMIN-only links (Problems, API keys, Moderators, ...) in the
 * rendered HTML, because those routes 403 for them (middleware.ts narrows
 * MODERATOR access to /admin/discussions*, and app/admin/layout.tsx admits
 * ADMIN or MODERATOR broadly — the sidebar's own role filter is the only
 * thing standing between a moderator and a wall of dead-end links).
 *
 * A MODERATOR can only ever reach /admin/discussions (middleware redirects
 * any other /admin/* path to "/" for them), so that's the page test 2 loads.
 * Reaching it also requires VIEW_DISCUSSION_QUEUE — ConsoleShell computes
 * `canViewDiscussionQueue` via `userHasDiscussionPermission`, which is a real
 * DB lookup against ModeratorPermission, not just a role string — so the
 * fixture grants that permission explicitly (same pattern as
 * moderators.spec.ts).
 *
 * All assertions are scoped to `nav[aria-label="Admin"]` (the sidebar's own
 * landmark, unique in the shell — ConsoleSidebar/ConsoleRail use "Primary")
 * rather than the page body, so they test the sidebar itself and can't pass
 * by accident on page-body text that happens to share a word with a nav
 * label.
 */
const NAMESPACE = "e2e-admin-shell"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`
const moderatorEmail = `${PREFIX}-moderator@example.test`

const problemSlug = `${PREFIX}-problem`
const PROBLEM_TITLE = "E2E Admin Shell Badge Problem"

let admin: SeededUser
let moderator: SeededUser

test.describe.configure({ mode: "serial" })

/**
 * Order matters: the ProblemReport references the problem (cascade on
 * delete), the problem references the schema, and both users' rows outlive
 * the report record — delete report/problem/schema before users so nothing
 * is left dangling if a step throws partway through.
 */
async function cleanup(): Promise<void> {
    await prisma.problemReport.deleteMany({ where: { message: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()

    ;[admin, moderator] = await Promise.all([
        seedUser({ email: adminEmail, role: "ADMIN", name: "E2E Admin Shell Admin" }),
        seedUser({
            email: moderatorEmail,
            role: "MODERATOR",
            name: "E2E Admin Shell Moderator",
        }),
    ])

    // Test 2 fixture: VIEW_DISCUSSION_QUEUE is a real permission lookup
    // (lib/discussions/permissions.ts), not implied by role alone — without
    // this the moderator can't even reach /admin/discussions and the test
    // would be exercising the wrong redirect, not the nav filter.
    await prisma.moderatorPermission.create({
        data: {
            userId: moderator.id,
            permission: "VIEW_DISCUSSION_QUEUE",
            grantedById: admin.id,
        },
    })

    // Test 3 fixture: an unresolved ProblemReport guarantees the ADMIN-only
    // "openReports" badge count is >= 1 regardless of what else is in the
    // database (the count itself is a global, unscoped aggregate — see
    // ConsoleShell.tsx — so this test only asserts "positive", never an
    // exact number).
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}-schema`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })
    const maxNumber = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (maxNumber._max.number ?? 0) + 95_001,
            title: PROBLEM_TITLE,
            slug: problemSlug,
            difficulty: "EASY",
            status: "PUBLISHED",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId: schema.id,
            expectedOutput: JSON.stringify([{ id: 1 }]),
            solutionSql: "SELECT id FROM t",
        },
    })
    await prisma.problemReport.create({
        data: {
            problemId: problem.id,
            userId: admin.id,
            kind: "WRONG_ANSWER",
            message: `${PREFIX} badge-count fixture report`,
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("an ADMIN at /admin sees the grouped sidebar", async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin")

    // Exactly one admin nav landmark — guards against a regression back to
    // a second, stacked nav row (the old components/admin/AdminNav.tsx).
    const adminNav = page.getByRole("navigation", { name: "Admin" })
    await expect(adminNav).toHaveCount(1)

    // Group headings only exist in the new grouped sidebar — the deleted
    // flat AdminNav had none, so asserting on two of them (not just one)
    // is a structural check, not just a label check.
    await expect(adminNav.getByText("Content", { exact: true })).toBeVisible()
    await expect(adminNav.getByText("Scheduling", { exact: true })).toBeVisible()

    const problemsLink = adminNav.getByRole("link", { name: /Problems/ })
    await expect(problemsLink).toBeVisible()
    await expect(problemsLink).toHaveAttribute("href", "/admin/problems")
})

test("a MODERATOR with discussion permission receives no admin-only links in the rendered HTML", async ({
    page,
}) => {
    await page.context().addCookies([sessionCookie(moderator.sessionToken, BASE_URL)])
    // A MODERATOR can only ever land on /admin/discussions* — middleware.ts
    // redirects every other /admin/* path to "/" for a non-ADMIN role, so
    // this is the one page where the sidebar actually renders for them.
    await page.goto("/admin/discussions")
    await expect(page).toHaveURL(`${BASE_URL}/admin/discussions`)

    const adminNav = page.getByRole("navigation", { name: "Admin" })
    await expect(adminNav).toHaveCount(1)

    await expect(adminNav.getByText("Problems", { exact: true })).toHaveCount(0)
    await expect(adminNav.getByText("API keys", { exact: true })).toHaveCount(0)
    await expect(adminNav.getByText("Moderators", { exact: true })).toHaveCount(0)
    // Bonus: Reports has no requiresDiscussionQueuePermission flag either,
    // so it should be filtered too.
    await expect(adminNav.getByText("Reports", { exact: true })).toHaveCount(0)

    await expect(
        adminNav.getByRole("link", { name: /Discussions/ })
    ).toBeVisible()
})

test("badge counts render when non-zero", async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
    await page.goto("/admin")

    const adminNav = page.getByRole("navigation", { name: "Admin" })
    const reportsLink = adminNav.locator('a[href="/admin/reports"]')
    await expect(reportsLink).toBeVisible()

    const badge = reportsLink.locator("span.tabular-nums")
    await expect(badge).toBeVisible()
    const badgeText = await badge.textContent()
    expect(Number(badgeText)).toBeGreaterThan(0)
})
