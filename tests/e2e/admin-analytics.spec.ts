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

test.describe.configure({ mode: "serial" })

async function cleanup(): Promise<void> {
    await prisma.moderatorPermission.deleteMany({
        where: { user: { email: { startsWith: PREFIX } } },
    })
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
