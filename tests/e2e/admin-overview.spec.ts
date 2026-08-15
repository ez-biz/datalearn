import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

/**
 * The admin Overview (`/admin`) — five metric cards (`MetricCard`), the
 * three-card queue stack (`QueueStack`), and the quick-action shortcut bar
 * (`AdminQuickActions`, rendered by `app/admin/layout.tsx` for ADMIN role on
 * every `/admin/*` screen, not just this one).
 *
 * THE MAIN CASE this file exists for: a quick-action shortcut must actually
 * navigate. This project has twice shipped a `Kbd` hint with no listener
 * behind it — the "/" shortcut found in SP4 and the hero's "↵" in SP6 — and
 * both were caught only by reading code, never by pressing a key. The
 * "New-problem shortcut" test below presses Alt+P for real and asserts the
 * URL becomes `/admin/problems/new`; a companion test proves the same
 * combination is ignored while a text input is focused, since a shortcut
 * that fires while someone is typing is a real bug in its own right.
 *
 * `AdminQuickActions`'s listener matches on `event.code` (e.g. "KeyP"), not
 * `event.key` — macOS remaps `.key` under Option (Option+P types "π") so
 * matching on `.key` would silently break every shortcut on a Mac. Verified
 * empirically (headless Chromium, this machine) that
 * `page.keyboard.press("Alt+P")` dispatches a keydown with
 * `{ code: "KeyP", altKey: true }` — Playwright's synthetic CDP dispatch
 * sets `code` from the physical-key descriptor directly, it does not run the
 * real OS-level Option dead-key remap that only affects `.key` — so the
 * literal "Alt+P" form is sufficient and needs no `KeyP`-suffixed variant.
 *
 * Metric-card delta lines (`MetricCard`) are honest by construction —
 * `computeDelta` (lib/admin/metric-delta.ts) returns `null` whenever a
 * metric has no real historical basis (Articles, Tracks, Open reports,
 * Pending review), and the card renders no delta line at all in that case,
 * not a zero and not a dash. "Contests" always has a real prior-period count
 * (even when it's 0 — see actions/admin-dashboard.ts), so its card is the
 * contrast case proving the svg-count assertion actually detects presence,
 * not just absence.
 *
 * All three metric/queue tests read only ambient data (Problems, Articles,
 * Tracks, Contests, Submissions counts and the three queue depths) —
 * nothing here creates or deletes rows outside the single ADMIN fixture
 * user, so there is nothing to restore.
 */
const NAMESPACE = "e2e-admin-overview"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`

let admin: SeededUser

test.describe.configure({ mode: "serial" })

async function cleanup(): Promise<void> {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()
    admin = await seedUser({
        email: adminEmail,
        role: "ADMIN",
        name: "E2E Admin Overview Admin",
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
})

test("an admin sees the five metric cards", async ({ page }) => {
    await page.goto("/admin")

    // Scoped to <main>, not the page as a whole: the admin sidebar (a
    // sibling of <main>, not a child — see ConsoleChrome.tsx) repeats
    // several of these same labels ("Tracks", "Contests", ...) as nav
    // links, so an unscoped text assertion could pass against the nav
    // instead of the grid this test actually cares about.
    const main = page.locator("main#main-content")
    const overview = main.locator("section").filter({ hasText: "OVERVIEW" })
    await expect(overview).toHaveCount(1)

    // The OVERVIEW section contains nothing but the Eyebrow label and the
    // five MetricCard links — no other anchors — so counting <a> here is a
    // direct count of rendered cards, not a proxy for it.
    await expect(overview.locator("a")).toHaveCount(5)

    for (const label of [
        "Problems",
        "Articles",
        "Tracks",
        "Contests",
        "Submissions (7d)",
    ]) {
        await expect(overview.getByText(label, { exact: true })).toBeVisible()
    }
})

test("a metric with no honest delta renders no delta line", async ({ page }) => {
    await page.goto("/admin")

    const main = page.locator("main#main-content")

    // Contrast case: Contests always carries a real (possibly zero, never
    // null) prior-period count, so `computeDelta` never returns null for it
    // and its card always renders a delta line — ArrowRight (always) plus
    // one direction icon (Up/Down/Minus). This proves the svg-count method
    // below can actually detect a *present* delta, not just an absent one;
    // without this contrast, a selector that matched nothing on every card
    // would pass the absence assertions vacuously.
    const contestsCard = main.locator('a[href="/admin/contests"]')
    await expect(contestsCard).toHaveCount(1)
    await expect(contestsCard.locator("svg")).toHaveCount(2)

    // Articles and Tracks have no createdAt-backed prior count in the
    // schema (see actions/admin-dashboard.ts) — `computeDelta` returns null
    // for both by design, so their cards must render only the ArrowRight
    // affordance icon and nothing else.
    for (const href of ["/admin/articles", "/admin/tracks"]) {
        const card = main.locator(`a[href="${href}"]`)
        await expect(card).toHaveCount(1)
        await expect(card.locator("svg")).toHaveCount(1)
    }
})

test("an empty queue card shows its honest empty state, not a bare 0", async ({
    page,
}) => {
    // QueueStack's "flagged comments" figure is a global DiscussionReport
    // OPEN count (AdminDashboard.tsx) with no per-test scoping possible —
    // deleting or flipping ambient rows to force it to zero is exactly the
    // "flip and finally-restore" pattern this project rejected once
    // already (a `finally` never runs on a killed process). Detect
    // instead: no other e2e spec file sorts before this one alphabetically
    // and creates a DiscussionReport, and neither prisma/seed.ts nor
    // prisma/seed-visual-lesson.ts create one, so CI's fresh database
    // should always read 0 here. Same skip-locally/fail-in-CI pattern as
    // tests/e2e/home-signed-out.spec.ts.
    const flaggedCount = await prisma.discussionReport.count({
        where: { status: "OPEN" },
    })
    if (flaggedCount > 0) {
        if (process.env.CI) {
            throw new Error(
                `CI is expected to seed no DiscussionReport rows, but found ` +
                    `${flaggedCount} OPEN row(s). This test's "flagged comments is ` +
                    `empty" premise depends on that assumption — investigate what ` +
                    `started creating discussion reports in CI before trusting this ` +
                    `test's pass/fail again.`
            )
        }
        test.skip(
            true,
            `skipped: ${flaggedCount} OPEN DiscussionReport row(s) present ` +
                `ambiently; this assertion requires the flagged-comments queue to be ` +
                `empty, which only a report-free database guarantees.`
        )
    }

    await page.goto("/admin")

    const main = page.locator("main#main-content")
    // QueueCard's own "Moderate" action link is the only element in <main>
    // with this href (the sidebar's matching nav link is a sibling of
    // <main>, not inside it), and it is a direct child of the QueueCard's
    // outer container alongside the label/count block — so its parent is
    // exactly the one card this test needs.
    const flaggedCard = main.locator('a[href="/admin/discussions"]').locator("xpath=..")
    await expect(flaggedCard).toContainText("Flagged comments")
    await expect(flaggedCard.getByText("Nothing waiting")).toBeVisible()
    // The honest-empty-state contract is violated just as much by a stray
    // "0" as by omitting "Nothing waiting" — assert its absence explicitly
    // rather than only asserting the copy is present.
    await expect(flaggedCard.getByText("0", { exact: true })).toHaveCount(0)
})

test("the New-problem shortcut actually navigates", async ({ page }) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(`${BASE_URL}/admin`)

    await page.keyboard.press("Alt+P")

    await expect(page).toHaveURL(`${BASE_URL}/admin/problems/new`)
    // Not just the URL — confirms client-side navigation actually landed on
    // the real destination page rather than an error boundary that happens
    // to leave the URL bar alone (notFound() renders HTTP 200 app-wide, so
    // this project never trusts a bare URL/status check alone).
    await expect(
        page.getByRole("heading", { level: 1, name: "New problem" })
    ).toBeVisible()
})

test("the shortcut is ignored while the target is a text input", async ({ page }) => {
    // /admin/contributors has a real <input type="search"> in its own
    // right (ContributorsClient's "Search by email or name…" box) — no
    // synthetic DOM needed, and AdminQuickActions is mounted from
    // app/admin/layout.tsx so its listener is live on this route exactly
    // as it is on every other /admin/* route.
    await page.goto("/admin/contributors")
    await expect(page).toHaveURL(`${BASE_URL}/admin/contributors`)

    const search = page.getByPlaceholder("Search by email or name…")
    await search.click()
    await expect(search).toBeFocused()

    await page.keyboard.press("Alt+P")

    // No navigation: isTypingTarget (AdminQuickActions.tsx) short-circuits
    // the handler before it ever looks at event.code.
    await expect(page).toHaveURL(`${BASE_URL}/admin/contributors`)
    await expect(
        page.getByRole("heading", { level: 1, name: "New problem" })
    ).toHaveCount(0)
})
