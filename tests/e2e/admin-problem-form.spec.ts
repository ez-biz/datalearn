import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

/**
 * The restructured problem form (SP7 phase 4) — its tab strip
 * (`components/admin/problem-form/FormTabStrip.tsx`), the pure tab/error
 * model it renders (`lib/admin/form-tabs.ts`), and the Curriculum tab's
 * `CurriculumPlacement` panel added in Task 11.
 *
 * This file is the standing regression guard Task 10 shipped without: it
 * proved "fields stay mounted across tabs" and "errors route to the right
 * tab" with throwaway specs, deleted before commit. Both come back here as
 * committed tests, plus the curriculum panel's own coverage.
 *
 * Fixture-string collision note (a sibling SP7 spec broke on exactly this):
 * `hasText`/`getByText` are case-insensitive substring matchers. Every
 * fixture title below is a made-up compound word beginning "Quazelfen" that
 * appears nowhere else in this file's own UI-chrome assertions ("Solution &
 * expected output", "Curriculum", "Saved", "No lessons exist yet", …) and
 * shares no substring with admin-problems.spec.ts's "Zqxvorlin Klorbeth" /
 * "Zqxvorlin Dravnix" fixtures. Most assertions here use role/id locators
 * scoped to a specific tabpanel rather than free-text search, which sidesteps
 * the collision class entirely.
 *
 * Ambient ModuleLesson rows: production ships with zero (see the Task 11
 * brief), but local dev commonly has 17 from `seed-analyst-track.ts`. The
 * empty-state test therefore detects ambient lessons and skips locally,
 * but FAILS instead of skipping when `process.env.CI` is set — CI seeds no
 * curriculum data, so a non-zero count there means the premise this test
 * depends on silently broke. Same pattern as
 * tests/e2e/admin-overview.spec.ts's ambient-zero check.
 *
 * Execution order matters and is intentional: the curriculum bind/unbind
 * test creates its own Track/Module/Article lesson fixture, and it does so
 * INSIDE that test (not in this file's `beforeAll`) specifically so the
 * empty-state test — which must run first — sees an ambient lesson count
 * unaffected by this file's own fixtures. `test.describe.configure({ mode:
 * "serial" })` guarantees tests run in file-definition order.
 */
const NAMESPACE = "e2e-admin-problem-form"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const adminEmail = `${PREFIX}-admin@example.test`

const TITLE_MAIN = "Quazelfen Bristlewick"
const SLUG_MAIN = `${PREFIX}-bristlewick`
const TITLE_PUBLISH = "Quazelfen Driftmarrow"
const SLUG_PUBLISH = `${PREFIX}-driftmarrow`
const TITLE_BIND = "Quazelfen Hollowreed"
const SLUG_BIND = `${PREFIX}-hollowreed`
const LESSON_TITLE = "Quazelfen Marrowlight"

let admin: SeededUser
let schemaId: string
let problemBindId: string

test.describe.configure({ mode: "serial" })

async function cleanup(): Promise<void> {
    await prisma.lessonCheckpoint.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.moduleLesson.deleteMany({
        where: { article: { slug: { startsWith: PREFIX } } },
    })
    await prisma.module.deleteMany({ where: { track: { slug: { startsWith: PREFIX } } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()

    admin = await seedUser({
        email: adminEmail,
        role: "ADMIN",
        name: "E2E Admin Problem Form Admin",
    })

    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}-schema`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })
    schemaId = schema.id

    const maxNumber = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const base = (maxNumber._max.number ?? 0) + 99_001

    // PROBLEM_MAIN — a normally-populated DRAFT problem. Used by the
    // field-persistence test (no save at all) and the Zod-path error-
    // routing test (clearing schemaId; status never changes, so the
    // hand-thrown PUBLISHED_DIALECT_MAP_INCOMPLETE path can't fire here).
    await prisma.sQLProblem.create({
        data: {
            number: base,
            title: TITLE_MAIN,
            slug: SLUG_MAIN,
            difficulty: "EASY",
            status: "DRAFT",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId,
            dialects: ["DUCKDB"],
            solutions: { DUCKDB: "SELECT id FROM t" },
            expectedOutputs: { DUCKDB: JSON.stringify([{ id: 1 }]) },
            expectedOutput: JSON.stringify([{ id: 1 }]),
            solutionSql: "SELECT id FROM t",
        },
    })

    // PROBLEM_PUBLISH — a two-dialect problem with only DUCKDB's
    // solution/expectedOutput captured, POSTGRES's left genuinely empty.
    // The legacy `solutionSql`/`expectedOutput` columns are left null/""
    // deliberately: ProblemForm seeds each listed dialect's state from the
    // legacy field whenever that dialect's own per-dialect entry is empty
    // (see its `solutions`/`expectedOutputs` useState initializers) — a
    // non-empty legacy value here would silently backfill POSTGRES too and
    // defeat this fixture. At submit time the form computes a FRESH legacy
    // value from whichever dialect is actually populated (DUCKDB), which is
    // what satisfies the Zod schema's own non-empty `expectedOutput` check;
    // the per-dialect maps sent to the server still show POSTGRES missing.
    // This is the realistic way an author trips
    // PUBLISHED_DIALECT_MAP_INCOMPLETE from the UI: publish before every
    // listed engine has a captured output. Unlike a Zod failure, this
    // hand-thrown route error carries no `details` at all (see
    // ProblemForm.tsx's fieldErrorsFromKnownServerMessage). This was a real
    // bug fixed in Task 10; it needs its own committed coverage.
    await prisma.sQLProblem.create({
        data: {
            number: base + 1,
            title: TITLE_PUBLISH,
            slug: SLUG_PUBLISH,
            difficulty: "EASY",
            status: "DRAFT",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId,
            dialects: ["DUCKDB", "POSTGRES"],
            solutions: { DUCKDB: "SELECT id FROM t" },
            expectedOutputs: { DUCKDB: JSON.stringify([{ id: 1 }]) },
            expectedOutput: "",
            solutionSql: null,
        },
    })

    // PROBLEM_BIND — target for the curriculum bind/unbind test. Starts
    // with no checkpoint binding.
    const bound = await prisma.sQLProblem.create({
        data: {
            number: base + 2,
            title: TITLE_BIND,
            slug: SLUG_BIND,
            difficulty: "EASY",
            status: "DRAFT",
            description: "Return one row.",
            schemaDescription: "One table.",
            schemaId,
            dialects: ["DUCKDB"],
            solutions: { DUCKDB: "SELECT id FROM t" },
            expectedOutputs: { DUCKDB: JSON.stringify([{ id: 1 }]) },
            expectedOutput: JSON.stringify([{ id: 1 }]),
            solutionSql: "SELECT id FROM t",
        },
    })
    problemBindId = bound.id
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
    await page.context().addCookies([sessionCookie(admin.sessionToken, BASE_URL)])
})

test("a field's DOM node persists across a tab switch, not just its value", async ({
    page,
}) => {
    await page.goto(`/admin/problems/${SLUG_MAIN}/edit`)

    const titleInput = page.locator("#title")
    await expect(titleInput).toBeVisible()
    await titleInput.fill(`${TITLE_MAIN} edited`)

    // The node itself, not a selector re-query: if tabs unmounted their
    // content on hide, this exact handle would become detached even though
    // a fresh `#title` element might "logically" exist once Basics is
    // revisited. A value-only assertion (re-reading `#title`'s value after
    // switching back) would pass even under that regression, because state
    // is lifted to ProblemForm and would simply be handed to a freshly
    // mounted input — see the task report for the measured proof.
    const titleHandle = await titleInput.elementHandle()
    expect(titleHandle).not.toBeNull()

    await page.getByRole("tab", { name: "Schema" }).click()
    await expect(page.locator("#form-tabpanel-schema")).toBeVisible()
    await expect(page.locator("#form-tabpanel-basics")).toBeHidden()

    expect(await titleHandle!.evaluate((el) => el.isConnected)).toBe(true)

    // And it's still the field the user was editing — the DOM identity
    // check above is the load-bearing one, but confirming the value is
    // untouched rules out a different bug (a silent reset on tab switch).
    expect(await titleHandle!.evaluate((el) => (el as HTMLInputElement).value)).toBe(
        `${TITLE_MAIN} edited`
    )
})

test("a Zod validation error on a hidden tab marks it and jumps to it", async ({ page }) => {
    await page.goto(`/admin/problems/${SLUG_MAIN}/edit`)

    await page.getByRole("tab", { name: "Schema" }).click()
    await page.locator("#schemaId").selectOption({ value: "" })

    // Move away before saving — the point is that the save itself performs
    // the jump, not that we're already sitting on the errored tab.
    await page.getByRole("tab", { name: "Hints" }).click()
    await expect(page.locator("#form-tabpanel-hints")).toBeVisible()

    const patchResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes(`/api/admin/problems/${SLUG_MAIN}`) &&
            response.request().method() === "PATCH"
    )
    await page.getByRole("button", { name: "Save changes" }).click()
    const patchResponse = await patchResponsePromise
    expect(patchResponse.ok()).toBe(false)
    const body = await patchResponse.json()
    expect(body.details).toBeTruthy() // the Zod path — has `details`, unlike the hand-thrown one below

    const schemaTab = page.getByRole("tab", { name: "Schema" })
    await expect(schemaTab).toHaveAttribute("aria-selected", "true")
    await expect(page.locator("#form-tabpanel-schema")).toBeVisible()
    await expect(page.locator("#form-tabpanel-hints")).toBeHidden()
    // The tab strip's own errored marker (the small destructive dot).
    await expect(schemaTab).toHaveClass(/text-destructive/)
})

test("a hand-thrown error with no Zod details also marks its tab and jumps to it", async ({
    page,
}) => {
    await page.goto(`/admin/problems/${SLUG_PUBLISH}/edit`)

    // PROBLEM_PUBLISH starts DRAFT with empty solutions/expectedOutputs.
    // Flipping to PUBLISHED trips PUBLISHED_DIALECT_MAP_INCOMPLETE — a
    // hand-thrown route error carrying `{ error, missing }` and no
    // `details` at all.
    await page.getByRole("button", { name: "Published", exact: true }).click()

    await page.getByRole("tab", { name: "Curriculum" }).click()
    await expect(page.locator("#form-tabpanel-curriculum")).toBeVisible()

    const patchResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes(`/api/admin/problems/${SLUG_PUBLISH}`) &&
            response.request().method() === "PATCH"
    )
    await page.getByRole("button", { name: "Save changes" }).click()
    const patchResponse = await patchResponsePromise
    expect(patchResponse.ok()).toBe(false)
    const body = await patchResponse.json()
    expect(body.details).toBeUndefined() // the non-Zod path — no `details` key at all
    expect(body.error).toContain("PUBLISHED problems require")
    // The route also sends a stable `code` alongside the text — see
    // fieldErrorsFromKnownServerMessage in ProblemForm.tsx, which now
    // matches on this first and falls back to the text below it.
    expect(body.code).toBe("PUBLISHED_DIALECT_MAP_INCOMPLETE")

    // Substring match on a prefix of the full "Solution & expected output"
    // label — Playwright's debug aria-snapshot tooling has been observed to
    // abbreviate long accessible names in its own dumps, so anchoring on a
    // shorter unambiguous prefix avoids depending on that rendering detail.
    const solutionTab = page.getByRole("tab", { name: "Solution & expected" })
    await expect(solutionTab).toHaveAttribute("aria-selected", "true")
    await expect(page.locator("#form-tabpanel-solution")).toBeVisible()
    await expect(page.locator("#form-tabpanel-curriculum")).toBeHidden()
    await expect(solutionTab).toHaveClass(/text-destructive/)
    await expect(page.locator("#form-tabpanel-solution")).toContainText(
        "PUBLISHED problems require"
    )
})

test("a hand-thrown error routes by `code` even when its message text no longer matches", async ({
    page,
}) => {
    // Proves fieldErrorsFromKnownServerMessage's code-first match actually
    // drives routing, not just that it doesn't regress the text path: mocks
    // the PATCH response with SLUG_TAKEN's real `code` but wording that
    // matches none of the hardcoded strings the old text-only matcher knew
    // about. If routing silently fell back to text matching, this would land
    // on the banner only and never mark the Basics tab.
    await page.goto(`/admin/problems/${SLUG_MAIN}/edit`)

    const rewordedMessage = "This wording intentionally does not match any known string."
    await page.route(`**/api/admin/problems/${SLUG_MAIN}`, async (route) => {
        if (route.request().method() !== "PATCH") {
            await route.continue()
            return
        }
        await route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({ error: rewordedMessage, code: "SLUG_TAKEN" }),
        })
    })

    await page.getByRole("tab", { name: "Hints" }).click()
    await expect(page.locator("#form-tabpanel-hints")).toBeVisible()

    await page.getByRole("button", { name: "Save changes" }).click()
    await expect(page.locator("#form-tabpanel-basics")).toContainText(rewordedMessage)

    const basicsTab = page.getByRole("tab", { name: "Basics" })
    await expect(basicsTab).toHaveAttribute("aria-selected", "true")
    await expect(page.locator("#form-tabpanel-basics")).toBeVisible()
    await expect(page.locator("#form-tabpanel-hints")).toBeHidden()
    await expect(basicsTab).toHaveClass(/text-destructive/)
})

test("the curriculum panel shows its honest empty state when no lessons exist", async ({
    page,
}) => {
    const ambientLessons = await prisma.moduleLesson.count()
    if (ambientLessons > 0) {
        if (process.env.CI) {
            throw new Error(
                `Expected zero ambient ModuleLesson rows in CI but found ${ambientLessons} — ` +
                    "this test's \"no lessons exist\" premise depends on that assumption; " +
                    "investigate what started seeding curriculum data in CI before trusting " +
                    "this test's pass/fail again."
            )
        }
        test.skip(
            true,
            `skipped: ${ambientLessons} ambient ModuleLesson row(s) present locally (e.g. from ` +
                "seed-analyst-track.ts) make \"no lessons exist\" false, and we cannot delete " +
                "them without violating \"don't mutate ambient data.\""
        )
    }

    await page.goto(`/admin/problems/${SLUG_MAIN}/edit`)
    await page.getByRole("tab", { name: "Curriculum" }).click()

    const panel = page.locator("#form-tabpanel-curriculum")
    await expect(panel).toBeVisible()
    await expect(
        panel.getByRole("heading", { level: 3, name: "No lessons exist yet" })
    ).toBeVisible()
    await expect(panel.getByRole("link", { name: "Create a lesson article" })).toHaveAttribute(
        "href",
        "/admin/articles/new"
    )
    // The honest empty state, not a dead control: no picker renders at all.
    await expect(panel.locator("select#curriculumLessonId")).toHaveCount(0)
    // Rule 3 ("a problem checks at most one lesson") still reads even with
    // nothing to bind yet.
    await expect(panel).toContainText("at most one lesson")
})

test("binding and unbinding a problem through the curriculum panel goes through addCheckpoint/removeCheckpoint", async ({
    page,
}) => {
    // Self-fixtured lesson, created here (not in beforeAll) so the empty-
    // state test above sees this file's own fixtures contribute zero
    // ambient lessons. Topic -> Article -> Track -> Module -> ModuleLesson
    // is the minimum shape addCheckpoint's own lookups + the picker's
    // "is this Article reachable as a lesson" definition both need.
    const topic = await prisma.topic.create({
        data: { name: `${PREFIX} Topic`, slug: `${PREFIX}-topic` },
    })
    const lessonArticle = await prisma.article.create({
        data: {
            title: LESSON_TITLE,
            slug: `${PREFIX}-lesson`,
            content: "Lesson body.",
            status: "PUBLISHED",
            topicId: topic.id,
            authorId: admin.id,
        },
    })
    const track = await prisma.track.create({
        data: {
            slug: `${PREFIX}-track`,
            name: `${PREFIX} Track`,
            summary: "Fixture track.",
            description: "Fixture track for the curriculum bind e2e test.",
        },
    })
    const module_ = await prisma.module.create({
        data: {
            trackId: track.id,
            slug: `${PREFIX}-module`,
            name: `${PREFIX} Module`,
            description: "Fixture module.",
            position: 0,
        },
    })
    await prisma.moduleLesson.create({
        data: { moduleId: module_.id, articleId: lessonArticle.id, position: 0 },
    })

    // Sanity: no checkpoint before the panel touches anything.
    const before = await prisma.lessonCheckpoint.findUnique({
        where: { problemId: problemBindId },
    })
    expect(before).toBeNull()

    await page.goto(`/admin/problems/${SLUG_BIND}/edit`)
    await page.getByRole("tab", { name: "Curriculum" }).click()

    const panel = page.locator("#form-tabpanel-curriculum")
    await expect(panel).toContainText("Not bound to any lesson yet")

    await panel.locator("select#curriculumLessonId").selectOption({ label: LESSON_TITLE })

    const bindResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes(`/api/admin/problems/${SLUG_BIND}`) &&
            response.request().method() === "PATCH"
    )
    await page.getByRole("button", { name: "Save changes" }).click()
    const bindResponse = await bindResponsePromise
    expect(bindResponse.ok()).toBe(true)

    const afterBind = await prisma.lessonCheckpoint.findUnique({
        where: { problemId: problemBindId },
    })
    expect(afterBind?.articleId).toBe(lessonArticle.id)
    expect(afterBind?.position).toBe(0)

    // Unbind: back to "— No lesson —" and save again.
    await page.reload()
    await page.getByRole("tab", { name: "Curriculum" }).click()
    await panel.locator("select#curriculumLessonId").selectOption({ value: "" })

    const unbindResponsePromise = page.waitForResponse(
        (response) =>
            response.url().includes(`/api/admin/problems/${SLUG_BIND}`) &&
            response.request().method() === "PATCH"
    )
    await page.getByRole("button", { name: "Save changes" }).click()
    const unbindResponse = await unbindResponsePromise
    expect(unbindResponse.ok()).toBe(true)

    const afterUnbind = await prisma.lessonCheckpoint.findUnique({
        where: { problemId: problemBindId },
    })
    expect(afterUnbind).toBeNull()
})
