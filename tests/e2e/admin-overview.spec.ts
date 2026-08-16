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
 * matching on `.key` would silently break every shortcut on a Mac.
 * `page.keyboard.press("Alt+P")` alone cannot prove that distinction: verified
 * empirically (headless Chromium, this machine) that it dispatches a keydown
 * with `{ key: "P", code: "KeyP", altKey: true }` — CDP's synthetic dispatch
 * never runs the real OS-level Option dead-key remap, so `.key` comes back as
 * the plain letter, which happens to equal the shortcut's own label too. A
 * listener written to match `event.key` would pass that test by accident. The
 * "matches on event.code, not event.key" test below closes that gap: it
 * dispatches a synthetic `KeyboardEvent` reproducing exactly what a real
 * macOS keyboard sends under Option+P — `key: "π"`, `code: "KeyP"` — directly
 * at `window` via `page.evaluate`, since `AdminQuickActions` listens on
 * `window` with a plain `addEventListener` and a dispatched event reaches it
 * the same as a real one would.
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
 * The queue-stack test seeds one unresolved `ProblemReport` (cleaned up with
 * the rest of the fixture) so the "Open reports" card has a real, non-empty
 * queue to contrast against "Pending review"/"Flagged comments", which stay
 * ambiently empty — otherwise a `QueueCard` hardcoded to its empty branch
 * would pass every assertion in this file. Every other test reads only
 * ambient data; nothing else here creates or deletes rows outside the single
 * ADMIN fixture user and this one queue fixture.
 */
const NAMESPACE = "e2e-admin-overview"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`
const problemSlug = `${PREFIX}-problem`

let admin: SeededUser

test.describe.configure({ mode: "serial" })

// Same dependency order as admin-shell.spec.ts's cleanup: the ProblemReport
// references the problem (cascade on delete), the problem references the
// schema, and both outlive the report record — delete report/problem/schema
// before the user so nothing is left dangling if a step throws partway
// through, and so a re-run's beforeAll cleanup (crash recovery) works too.
async function cleanup(): Promise<void> {
    await prisma.problemReport.deleteMany({ where: { message: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()
    admin = await seedUser({
        email: adminEmail,
        role: "ADMIN",
        name: "E2E Admin Overview Admin",
    })

    // Queue-stack fixture (see file doc comment): one unresolved
    // ProblemReport guarantees the "Open reports" queue is non-empty
    // regardless of ambient state, the same way admin-shell.spec.ts's badge
    // fixture does for the sidebar count.
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}-schema`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })
    const maxNumber = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (maxNumber._max.number ?? 0) + 97_001,
            // Deliberately not "...Overview..." — the RecentActivityFeed
            // card that will show this fixture's "Problem reported" entry
            // is itself a <section> inside <main>, and Playwright's
            // `hasText` string filter matches case-insensitively; a title
            // containing "Overview" made that feed section match test 1's
            // `section` `hasText: "OVERVIEW"` scoping too, inflating its
            // count from 1 to 2.
            title: "E2E Admin Queue Fixture Problem",
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
            message: `${PREFIX} open-reports queue fixture report`,
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

test("the queue stack shows a real count for an occupied queue and honest empty states for the rest", async ({
    page,
}) => {
    // The "still empty" half of this contrast only means something if
    // pendingArticles/flaggedComments really are ambiently zero — deleting
    // or flipping ambient rows to force it would be exactly the "flip and
    // finally-restore" pattern this project rejected once already (a
    // `finally` never runs on a killed process). Detect instead: no other
    // e2e spec file sorts before this one alphabetically and creates a
    // DiscussionReport or a SUBMITTED Article, and neither prisma/seed.ts
    // nor prisma/seed-visual-lesson.ts create either, so CI's fresh
    // database should always read 0 for both. Same skip-locally/fail-in-CI
    // pattern as tests/e2e/home-signed-out.spec.ts. The "Open reports" half
    // needs no such check — this file's own beforeAll fixture guarantees it
    // is non-zero regardless of ambient state.
    const [flaggedCount, pendingArticleCount] = await Promise.all([
        prisma.discussionReport.count({ where: { status: "OPEN" } }),
        prisma.article.count({ where: { status: "SUBMITTED" } }),
    ])
    const ambientNonZero: string[] = []
    if (flaggedCount > 0) {
        ambientNonZero.push(`${flaggedCount} OPEN DiscussionReport row(s)`)
    }
    if (pendingArticleCount > 0) {
        ambientNonZero.push(`${pendingArticleCount} SUBMITTED Article row(s)`)
    }
    if (ambientNonZero.length > 0) {
        const found = ambientNonZero.join("; ")
        if (process.env.CI) {
            throw new Error(
                `CI is expected to seed neither DiscussionReport nor SUBMITTED ` +
                    `Article rows, but found ${found}. This test's "still empty" ` +
                    `premise depends on that assumption — investigate what started ` +
                    `creating them in CI before trusting this test's pass/fail again.`
            )
        }
        test.skip(
            true,
            `skipped: ${found} present ambiently; this assertion requires the ` +
                `pending-articles and flagged-comments queues to both be empty, ` +
                `which only a report/discussion-free database guarantees.`
        )
    }

    await page.goto("/admin")

    const main = page.locator("main#main-content")

    // Occupied: this file's beforeAll seeded one unresolved ProblemReport,
    // so "Open reports" must show its real count, not "Nothing waiting",
    // regardless of ambient noise. Located by the card's own action link's
    // accessible name ("Triage" — QueueStack.tsx's verb for this queue),
    // not by href alone: RecentActivityFeed also links to "/admin/reports"
    // for "problem-reported" activity items — including this very fixture,
    // since it falls inside the 14-day activity window — so an href-only
    // selector would resolve to two different elements here.
    const openReportsCard = main
        .getByRole("link", { name: "Triage", exact: true })
        .locator("xpath=..")
    await expect(openReportsCard).toContainText("Open reports")
    await expect(openReportsCard).not.toContainText("Nothing waiting")
    await expect(openReportsCard).toContainText(/[1-9]\d*/)

    // Still empty, same page load, same run: neither this fixture nor
    // anything else in this suite touches Article or DiscussionReport rows,
    // so these two must render their honest empty state, not a bare "0".
    const pendingArticlesCard = main
        .getByRole("link", { name: "Review", exact: true })
        .locator("xpath=..")
    await expect(pendingArticlesCard).toContainText("Nothing waiting")
    await expect(pendingArticlesCard.getByText("0", { exact: true })).toHaveCount(0)

    const flaggedCard = main
        .getByRole("link", { name: "Moderate", exact: true })
        .locator("xpath=..")
    await expect(flaggedCard).toContainText("Nothing waiting")
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

test("the shortcut matches event.code, not event.key (the macOS Option-remap case)", async ({
    page,
}) => {
    await page.goto("/admin")
    await expect(page).toHaveURL(`${BASE_URL}/admin`)

    // Reproduces exactly what a real macOS keyboard delivers under
    // Option+P — `.key` remapped to "π" (the dead-key character Option+P
    // actually types), `.code` unchanged as the physical "KeyP" —
    // dispatched straight at `window`, where AdminQuickActions's plain
    // addEventListener lives. page.keyboard.press("Alt+P") cannot produce
    // this shape (see file doc comment: CDP's synthetic dispatch never
    // simulates the real OS remap), so this is the only way to prove the
    // listener reads `.code` and not `.key`.
    await page.evaluate(() => {
        window.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: "π",
                code: "KeyP",
                altKey: true,
                bubbles: true,
                cancelable: true,
            })
        )
    })

    await expect(page).toHaveURL(`${BASE_URL}/admin/problems/new`)
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

    // toHaveURL/toHaveCount below succeed the instant their condition
    // already holds, so without a settle this test would pass today only
    // because isTypingTarget short-circuits synchronously — it would not
    // catch a regression that scheduled a *delayed* navigation from a
    // typing target (e.g. via setTimeout or a stray .then()). Give any such
    // navigation a real window to occur before asserting none did.
    await page.waitForTimeout(500)

    // No navigation: isTypingTarget (AdminQuickActions.tsx) short-circuits
    // the handler before it ever looks at event.code.
    await expect(page).toHaveURL(`${BASE_URL}/admin/contributors`)
    await expect(
        page.getByRole("heading", { level: 1, name: "New problem" })
    ).toHaveCount(0)
})
