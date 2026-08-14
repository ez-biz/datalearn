import { expect, test } from "@playwright/test"
import { prisma, seedUser, sessionCookie, type SeededUser } from "./fixtures/db"

/**
 * The signed-in home dashboard — `/` for an authenticated user, rendered by
 * `SignedInHome` (components/home/dashboard/SignedInHome.tsx) via
 * `getHomeData` (lib/home/home-read.ts).
 *
 * Production ships zero Track rows with modules today, so the sparse path
 * — no ModuleProgress, no WeakSpotsCard, ResumeCard/TodayPlan falling back
 * to "next unsolved catalog problem" — is the one that actually ships. Test
 * 1 covers exactly that shape and runs first, per the plan.
 *
 * Local Postgres (unlike CI, which seeds no curriculum at all) can carry a
 * real, PUBLISHED, module-bearing track (`analyst-interview-prep`, from
 * `seed-analyst-track.ts`). `pickActiveTrack` (lib/home/home-read.ts) falls
 * back to the first visible track for a learner with zero progress on
 * anything, so that ambient track would otherwise leak into test 1's
 * "no curriculum" assertion and make it fail locally while passing in CI —
 * exactly the kind of environment-dependent flake this suite must not have.
 *
 * Test 1 does NOT mutate ambient rows to neutralize this — an earlier
 * version snapshotted every PUBLISHED module-bearing track, flipped it to
 * DRAFT, and restored the original status in a `finally`. That `finally`
 * does not run on process termination (Ctrl+C, OOM, a killed worker), which
 * could leave a developer's real curriculum silently stuck in DRAFT — the
 * same failure class as this project's earlier fixture-leak bug, and
 * silent besides. Fixed by detecting instead of mutating: query for
 * PUBLISHED module-bearing tracks and, if any exist, either skip (local —
 * this assertion needs a curriculum-free database, which only CI
 * guarantees) or fail loudly (CI — `test.yml` seeds no curriculum, so a
 * module-bearing track there means that assumption broke; a silent skip in
 * CI would let this assertion quietly stop running forever the day someone
 * adds curriculum seeding). No writes to ambient rows at any point, so a
 * crash mid-test leaves nothing behind to clean up.
 *
 * This file's own track/module fixture (test 3) is seeded as DRAFT in
 * `beforeAll` and flipped to PUBLISHED only inside test 3, so it can never
 * leak into test 1 either — no snapshot/restore needed for our own fixture,
 * it simply doesn't exist yet from the app's point of view until test 3
 * turns it on.
 */
const NAMESPACE = "e2e-home-signed-in"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`
const BASE_URL =
    process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? "3100"}`

const emptyEmail = `${PREFIX}-empty@example.test`
const submissionsEmail = `${PREFIX}-submissions@example.test`
const trackLearnerEmail = `${PREFIX}-track-learner@example.test`
const authorEmail = `${PREFIX}-author@example.test`

const topicSlug = `${PREFIX}-topic`
const lessonASlug = `${PREFIX}-lesson-a`
const lessonBSlug = `${PREFIX}-lesson-b`
const LESSON_A_TITLE = "E2E Home Dashboard Lesson A"
const LESSON_B_TITLE = "E2E Home Dashboard Lesson B"
const trackSlug = `${PREFIX}-track`
const TRACK_NAME = "E2E Home Dashboard Track"
const moduleSlug = "module-a"
const MODULE_NAME = "E2E Home Dashboard Foundations"

const problemSlug = `${PREFIX}-problem`
const PROBLEM_TITLE = "E2E Home Dashboard Submission Problem"

let emptyUser: SeededUser
let submissionsUser: SeededUser
let trackLearner: SeededUser

test.describe.configure({ mode: "serial" })

/**
 * Order matters (same reasoning as module.spec.ts): articles first
 * (cascades ModuleLesson/LessonCheckpoint/LessonProgress), then the track
 * (cascades its modules), then the topic, then the problem/schema fixture,
 * then users last (Article.authorId is onDelete: Restrict, so the author
 * must go after the article that references it).
 */
async function cleanup(): Promise<void> {
    await prisma.article.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(async () => {
    await cleanup()

    emptyUser = await seedUser({ email: emptyEmail })
    submissionsUser = await seedUser({ email: submissionsEmail })
    trackLearner = await seedUser({ email: trackLearnerEmail })
    const author = await seedUser({ email: authorEmail, name: "E2E Home Dashboard Author" })

    // Test 2 fixture: a published problem + an ACCEPTED submission for it.
    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}-schema`,
            sql: "CREATE TABLE t (id INTEGER); INSERT INTO t VALUES (1);",
        },
    })
    const maxNumber = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    const problem = await prisma.sQLProblem.create({
        data: {
            number: (maxNumber._max.number ?? 0) + 90_001,
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
    await prisma.submission.create({
        data: {
            userId: submissionsUser.id,
            problemId: problem.id,
            status: "ACCEPTED",
            code: "SELECT id FROM t",
        },
    })

    // Test 3 fixture: a track with one module and two lessons, seeded DRAFT
    // so it stays invisible until test 3 explicitly publishes it — see the
    // file doc comment on why that matters for test 1.
    const topic = await prisma.topic.create({
        data: {
            name: `${PREFIX} topic`,
            slug: topicSlug,
            description: "Topic that owns the home-dashboard fixture articles.",
        },
    })
    const [lessonA, lessonB] = await Promise.all([
        prisma.article.create({
            data: {
                title: LESSON_A_TITLE,
                slug: lessonASlug,
                content: "Lesson A body.",
                summary: "First lesson — completed by the fixture track learner.",
                readingMinutes: 5,
                status: "PUBLISHED",
                topicId: topic.id,
                authorId: author.id,
            },
        }),
        prisma.article.create({
            data: {
                title: LESSON_B_TITLE,
                slug: lessonBSlug,
                content: "Lesson B body.",
                summary: "Second lesson — left incomplete, so it's the resume target.",
                readingMinutes: 4,
                status: "PUBLISHED",
                topicId: topic.id,
                authorId: author.id,
            },
        }),
    ])

    await prisma.track.create({
        data: {
            slug: trackSlug,
            name: TRACK_NAME,
            summary: "A track that exists purely for home-signed-in.spec.ts.",
            description: "One module, two lessons, one completed.",
            status: "DRAFT",
            estimatedMinutes: 15,
            modules: {
                create: [
                    {
                        slug: moduleSlug,
                        name: MODULE_NAME,
                        description: "The dashboard's featured module for this fixture.",
                        position: 0,
                        lessons: {
                            create: [
                                { articleId: lessonA.id, position: 0 },
                                { articleId: lessonB.id, position: 1 },
                            ],
                        },
                    },
                ],
            },
        },
    })

    // Mark lesson A complete for the track learner so findResume lands on
    // lesson B, and so the track has real (>0%) progress — that's what
    // makes pickActiveTrack choose this fixture deterministically once it's
    // published, regardless of what else is visible (e.g. analyst-
    // interview-prep, always 0% for a brand-new user).
    await prisma.lessonProgress.create({
        data: {
            userId: trackLearner.id,
            articleId: lessonA.id,
            completedAt: new Date(),
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test("a learner with no curriculum and no submissions sees a coherent dashboard with no Module progress and no Weak spots", async ({
    page,
}) => {
    // Detect, never mutate — see the file doc comment above. A crash
    // between a flip and a restore is a worse outcome than a skipped test.
    const ambientModuleTracks = await prisma.track.findMany({
        where: { status: "PUBLISHED", modules: { some: {} } },
        select: { slug: true },
    })

    if (ambientModuleTracks.length > 0) {
        const found = ambientModuleTracks.map((t) => t.slug).join(", ")
        if (process.env.CI) {
            // Loud, not skipped: test.yml is documented to seed no
            // curriculum, so a module-bearing track here means that
            // assumption has broken. A silent skip would let this
            // assertion quietly stop running the day that changes.
            throw new Error(
                `CI is expected to seed no curriculum (see .github/workflows/test.yml), ` +
                    `but found ${ambientModuleTracks.length} PUBLISHED module-bearing ` +
                    `track(s) (${found}). This test's "no curriculum" assertion depends on ` +
                    `that assumption — investigate what started seeding curriculum data in ` +
                    `CI before trusting this test's pass/fail again.`
            )
        }
        test.skip(
            true,
            `skipped: ${ambientModuleTracks.length} published module-bearing track(s) ` +
                `present (${found}); this assertion requires a curriculum-free database, ` +
                `which is CI's shape.`
        )
    }

    await page.context().addCookies([sessionCookie(emptyUser.sessionToken, BASE_URL)])
    await page.goto("/")

    // Normal shell route (not the lesson reader's focus route): footer
    // and exactly one banner landmark, same guard module.spec.ts uses.
    await expect(page.getByRole("contentinfo")).toHaveCount(1)
    await expect(page.getByRole("banner")).toHaveCount(1)

    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(
        "Welcome back"
    )

    // The two cards that are gated by the fallback rule and must not
    // appear when there is nothing to feature.
    await expect(
        page.getByRole("heading", { name: "Module progress" })
    ).toHaveCount(0)
    await expect(page.getByRole("heading", { name: "Weak spots" })).toHaveCount(0)

    // Cards that never return null render their honest empty/zero
    // state instead of vanishing. `.first()` throughout: the App-Router
    // hydration/streaming pass can briefly render a second copy of these
    // elements — the settled DOM renders each once, but an un-scoped
    // locator strict-mode-violates on the transient duplicate. Same
    // guard as daily.spec.ts and tracks.spec.ts.
    await expect(page.getByText("No submissions yet").first()).toBeVisible()
    // StreakCard renders the count and the "day streak" label as
    // sibling <span>s with no literal space between them in the
    // compiled JSX, so match loosely rather than assume a space.
    await expect(page.getByText(/0\s*day streak/).first()).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "Progress by difficulty" }).first()
    ).toBeVisible()
})

test("a learner with an accepted submission sees it in Recent submissions with an Accepted chip", async ({
    page,
}) => {
    await page.context().addCookies([
        sessionCookie(submissionsUser.sessionToken, BASE_URL),
    ])
    await page.goto("/")

    await expect(
        page.getByRole("heading", { name: "Recent submissions" }).first()
    ).toBeVisible()
    await expect(page.getByText(PROBLEM_TITLE).first()).toBeVisible()
    await expect(
        page.getByText("Accepted", { exact: true }).first()
    ).toBeVisible()
})

test("a learner with a seeded track and module sees Module progress and a resume target", async ({
    page,
}) => {
    await prisma.track.update({
        where: { slug: trackSlug },
        data: { status: "PUBLISHED" },
    })

    await page.context().addCookies([
        sessionCookie(trackLearner.sessionToken, BASE_URL),
    ])
    await page.goto("/")

    // Module progress: the card grid renders our one seeded module. Scoped
    // to the "Module progress" <section> — a bare name-regex match on the
    // module link would also hit TodayPlan's lesson row above it, whose
    // meta line ("Module 01 · <name>") repeats the same module name.
    // `.first()` throughout: same hydration/streaming guard as the other
    // two tests in this file.
    const moduleProgressSection = page.locator("section", {
        has: page.getByRole("heading", { name: "Module progress" }),
    })
    await expect(moduleProgressSection.first()).toBeVisible()
    await expect(
        moduleProgressSection
            .first()
            .getByRole("link", { name: new RegExp(MODULE_NAME) })
    ).toHaveAttribute(
        "href",
        `/learn/tracks/${trackSlug}/modules/${moduleSlug}`
    )

    // Resume target: lesson A is complete, so ResumeCard/TodayPlan point at
    // lesson B.
    await expect(
        page.getByText("Pick up where you stopped").first()
    ).toBeVisible()
    await expect(
        page.getByRole("heading", { name: LESSON_B_TITLE }).first()
    ).toBeVisible()
    await expect(
        page.getByRole("link", { name: /resume/i }).first()
    ).toHaveAttribute("href", `/learn/tracks/${trackSlug}/${lessonBSlug}`)
})
