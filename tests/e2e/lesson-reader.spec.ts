import { expect, test, type Page } from "@playwright/test"
import {
    deleteUser,
    prisma,
    seedUser,
    sessionCookie,
    SESSION_COOKIE_NAME,
    type SeededUser,
} from "./fixtures/db"

/**
 * The lesson reader — /learn/tracks/<track>/<lesson>.
 *
 * This spec seeds its OWN track, module, lessons and checkpoint rather than
 * asserting against `analyst-interview-prep`. Depending on seed data would
 * make the suite fail on any database that has not been seeded (CI runs
 * `prisma/seed.ts` but not `seed-analyst-track.ts`), and every other spec in
 * this directory seeds its own fixtures.
 *
 * The seeded track is DRAFT and its lessons are PUBLISHED, which is exactly
 * the shape the staff-preview gate exists for: staff see it, nobody else
 * does. `DRAFT_CANARY` lives in the lesson body so the draft-visibility
 * tests can assert the body did not leak — a stronger claim than an HTTP
 * status, and the only one available here (see the note on `notFound()`
 * below).
 */
const NAMESPACE = "e2e-lesson-reader"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ??
    `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const DRAFT_CANARY = "draft-canary-must-not-leak"

const topicSlug = `${PREFIX}-topic`
const trackSlug = `${PREFIX}-track`
const lessonOneSlug = `${PREFIX}-lesson-one`
const lessonTwoSlug = `${PREFIX}-lesson-two`

const adminEmail = `${PREFIX}-admin@example.test`
const learnerEmail = `${PREFIX}-learner@example.test`
const emails = [adminEmail, learnerEmail]

const LESSON_ONE_TITLE = "E2E Reader Lesson One"
const LESSON_TWO_TITLE = "E2E Reader Lesson Two"

/**
 * No leading `# Heading`: `stripLeadingH1` would remove it anyway, and
 * leaving it out keeps the "exactly one h1" assertion measuring the reader's
 * own title rather than the strip helper. The `##` headings give
 * `extractToc` something to build a Contents nav from.
 */
const LESSON_ONE_BODY = [
    `This body carries the string ${DRAFT_CANARY} so that a draft leak is`,
    "provable rather than inferred from a status code.",
    "",
    "## Grouping rows",
    "",
    "`GROUP BY` collapses every row that shares a key into a single output",
    "row, and every column in the select list must then be either a grouping",
    "key or an aggregate.",
    "",
    "```sql",
    "SELECT customer_id, COUNT(*) AS orders",
    "FROM orders",
    "GROUP BY customer_id;",
    "```",
    "",
    "## Filtering groups",
    "",
    "`WHERE` runs before grouping and `HAVING` runs after it, which is the",
    "whole reason both exist. Filtering on an aggregate belongs in `HAVING`.",
    "",
    "### A common pitfall",
    "",
    "Putting an aggregate in `WHERE` is a parse error in every engine this",
    "platform ships, so the mistake surfaces immediately rather than as a",
    "silently wrong number.",
].join("\n")

const LESSON_TWO_BODY = [
    "The second lesson exists so prev/next has somewhere to go.",
    "",
    "## Ordering results",
    "",
    "`ORDER BY` is the last clause the engine evaluates, so it can reference",
    "select-list aliases that `WHERE` cannot.",
].join("\n")

let admin: SeededUser
let learner: SeededUser
let checkpointProblemTitle: string
let checkpointProblemNumber: number

/**
 * Attach a seeded session to this test's browser context.
 *
 * The cookie is cleared by name first. A dead `authjs.session-token` in the
 * jar makes Auth.js emit a clearing `Set-Cookie` on the next request, which
 * wipes a freshly-set replacement travelling in the same exchange; removing
 * it by name means there is never a dead token to clear.
 */
async function signInAs(page: Page, user: SeededUser): Promise<void> {
    await page.context().clearCookies({ name: SESSION_COOKIE_NAME })
    await page.context().addCookies([sessionCookie(user.sessionToken, BASE_URL)])
}

/**
 * Namespace-wide, not run-scoped: a crashed previous run leaves rows behind
 * and `Article.author` is `onDelete: Restrict`, so those rows have to go
 * before this run's users can be seeded and deleted cleanly.
 *
 * Order matters. Articles first (that cascades `ModuleLesson`,
 * `LessonCheckpoint` and `LessonProgress`), then the track (cascading its
 * modules), then the topic, then the users that authored the articles.
 */
async function cleanup(): Promise<void> {
    await prisma.article.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: NAMESPACE } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: NAMESPACE } } })
}

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()
    ;[admin, learner] = await Promise.all([
        seedUser({ email: adminEmail, role: "ADMIN", name: "E2E Reader Admin" }),
        seedUser({ email: learnerEmail, name: "E2E Reader Learner" }),
    ])

    const topic = await prisma.topic.create({
        data: {
            name: `${PREFIX} topic`,
            slug: topicSlug,
            description: "Topic that owns the reader fixture articles.",
        },
    })

    const [lessonOne, lessonTwo] = await Promise.all([
        prisma.article.create({
            data: {
                title: LESSON_ONE_TITLE,
                slug: lessonOneSlug,
                content: LESSON_ONE_BODY,
                summary: "Grouping and filtering, with a worked example.",
                readingMinutes: 5,
                status: "PUBLISHED",
                topicId: topic.id,
                authorId: admin.id,
            },
        }),
        prisma.article.create({
            data: {
                title: LESSON_TWO_TITLE,
                slug: lessonTwoSlug,
                content: LESSON_TWO_BODY,
                summary: "Ordering, and why it evaluates last.",
                readingMinutes: 4,
                status: "PUBLISHED",
                topicId: topic.id,
                authorId: admin.id,
            },
        }),
    ])

    await prisma.track.create({
        data: {
            slug: trackSlug,
            name: "E2E Reader Track",
            summary: "A DRAFT track, so only staff can read it.",
            description: "Two lessons and one checkpoint.",
            // DRAFT is the point: the two draft-visibility tests below assert
            // that nobody but staff gets the body.
            status: "DRAFT",
            estimatedMinutes: 20,
            modules: {
                create: [
                    {
                        slug: `${PREFIX}-module`,
                        name: "Aggregation",
                        description: "Grouping, filtering and ordering.",
                        position: 0,
                        lessons: {
                            create: [
                                { articleId: lessonOne.id, position: 0 },
                                { articleId: lessonTwo.id, position: 1 },
                            ],
                        },
                    },
                ],
            },
        },
    })

    // `LessonCheckpoint.@@unique([problemId])` encodes "a problem checkpoints
    // exactly one lesson", so an already-checkpointed problem would P2002
    // here. `contestLock: null` matters too: `getTrackCurriculumForUser`
    // filters contest-locked problems out of the curriculum, and a filtered
    // checkpoint renders nothing to assert on.
    let problem = await prisma.sQLProblem.findFirst({
        where: {
            status: "PUBLISHED",
            lessonCheckpoint: null,
            contestLock: null,
        },
        orderBy: { number: "asc" },
        select: { id: true, title: true, number: true },
    })

    if (!problem) {
        // Nothing free on this database — mint one rather than skip, so the
        // checkpoint assertion below is never silently unenforced.
        const schema = await prisma.sqlSchema.create({
            data: {
                name: `${NAMESPACE}-schema-${RUN_ID}`,
                sql: "CREATE TABLE t (id INTEGER);",
            },
        })
        const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
        problem = await prisma.sQLProblem.create({
            data: {
                number: (max._max.number ?? 0) + 1,
                slug: `${PREFIX}-checkpoint-problem`,
                title: "E2E Reader Checkpoint Problem",
                description: "Checkpoint fixture for the lesson reader spec.",
                schemaDescription: "One table.",
                schemaId: schema.id,
                expectedOutput: "[]",
                status: "PUBLISHED",
                difficulty: "EASY",
                dialects: ["DUCKDB"],
            },
            select: { id: true, title: true, number: true },
        })
    }

    checkpointProblemTitle = problem.title
    checkpointProblemNumber = problem.number

    await prisma.lessonCheckpoint.create({
        data: { articleId: lessonOne.id, problemId: problem.id, position: 0 },
    })
})

test.afterAll(async () => {
    await cleanup()
    for (const email of emails) {
        await deleteUser(email)
    }
    await prisma.$disconnect()
})

test.describe("lesson reader", () => {
    // Pinned rather than inherited. `CurriculumRail` is `xl:block` (1280px)
    // and `LessonAsideRail` is `lg:block` (1024px); the Desktop Chrome
    // default viewport is exactly 1280 wide, which sits on the `xl` boundary
    // and would make the rail assertions turn on a single pixel. 1440 is one
    // of the two widths the design is specified at.
    test.use({ viewport: { width: 1440, height: 900 } })

    // Assert on CONTENT, not HTTP status. `notFound()` returns 200 app-wide
    // in this build — streaming commits the status before the throw — and
    // that holds even for a nonexistent path. `tests/e2e/security.spec.ts`
    // already documents this, and every page-level not-found test in this
    // repo asserts the rendered body. Asserting the draft body is ABSENT is
    // also the stronger claim: it proves nothing leaked, which is the thing
    // actually at stake.
    test("does not leak a DRAFT track to anonymous visitors", async ({
        page,
    }) => {
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        const html = (await page.content()).toLowerCase()
        expect(html).toContain("not found")
        expect(html).not.toContain(DRAFT_CANARY)
    })

    test("does not leak a DRAFT track to a signed-in non-staff user", async ({
        page,
    }) => {
        await signInAs(page, learner)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        const html = (await page.content()).toLowerCase()
        expect(html).toContain("not found")
        expect(html).not.toContain(DRAFT_CANARY)
    })

    test("renders exactly one banner, one main and one h1", async ({ page }) => {
        await signInAs(page, admin)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        await expect(page.getByRole("banner")).toHaveCount(1)
        await expect(page.getByRole("main")).toHaveCount(1)
        await expect(page.locator("h1")).toHaveCount(1)
        await expect(page.locator("h1")).toHaveText(LESSON_ONE_TITLE)
    })

    test("suppresses the console shell", async ({ page }) => {
        await signInAs(page, admin)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        await expect(
            page.getByRole("navigation", { name: "Curriculum" }),
        ).toBeVisible()
        await expect(page.getByRole("contentinfo")).toHaveCount(0)
    })

    test("marks exactly one lesson as the current page", async ({ page }) => {
        await signInAs(page, admin)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        await expect(page.locator('[aria-current="page"]')).toHaveCount(1)
    })

    test("renders the lesson's checkpoint", async ({ page }) => {
        await signInAs(page, admin)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        const checkpoint = page.getByRole("region", { name: "Checkpoint" })
        await expect(checkpoint).toBeVisible()
        await expect(checkpoint).toContainText(
            `${checkpointProblemNumber}. ${checkpointProblemTitle}`,
        )
    })

    test("navigates to the next lesson", async ({ page }) => {
        await signInAs(page, admin)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        await page.getByRole("link", { name: /next/i }).first().click()

        await expect(page).toHaveURL(
            new RegExp(`/learn/tracks/${trackSlug}/${lessonTwoSlug}`),
        )
        await expect(page.locator("h1")).toHaveText(LESSON_TWO_TITLE)
    })

    test("the lesson-state card tracks the progress bar", async ({ page }) => {
        await signInAs(page, admin)
        await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)

        const bar = page.getByRole("progressbar", { name: "Reading progress" })

        // Retried rather than scrolled once. `MainScrollRestoration` resets
        // #app-scroll to 0 in a LAYOUT effect on mount, and
        // `ReaderProgressProvider` takes its first measurement in a PASSIVE
        // effect — which runs after. A scroll that lands before hydration is
        // therefore undone before anything reads it, and the one-shot version
        // of this test would hang on a page that had simply hydrated late.
        await expect(async () => {
            await page.evaluate(() => {
                const el = document.getElementById("app-scroll")
                if (el) el.scrollTop = el.scrollHeight
            })
            await expect(bar).toHaveAttribute("aria-valuenow", "100", {
                timeout: 1_000,
            })
        }).toPass({ timeout: 30_000 })

        // The card and the bar share one provider; a frozen card here means
        // the provider was bypassed.
        await expect(page.getByText("Auto-completed at 100%")).toBeVisible()
    })
})
