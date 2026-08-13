import { expect, test } from "@playwright/test"
import { prisma, seedUser } from "./fixtures/db"

/**
 * The module screen — /learn/tracks/<track>/modules/<module>.
 *
 * This spec seeds its OWN track/module/lesson fixture rather than reading
 * `analyst-interview-prep`. Two reasons, both load-bearing:
 *
 *  1. `prisma/seed.ts` (what CI runs) creates no Track/Module rows at all —
 *     `seed-analyst-track.ts` is a local-only script, never invoked by
 *     .github/workflows/test.yml. So on a freshly-seeded CI database there
 *     is no module to query for; `prisma.module.findFirst()` would return
 *     null.
 *  2. Even where `analyst-interview-prep` does exist (a developer's local
 *     DB, hand-published in an earlier session), a signed-out visitor's
 *     access to it depends on `Track.status`, which this suite must not
 *     assume either way and must not mutate (mutating shared seed data
 *     would leak into every other spec that reads it).
 *
 * Seeding our own PUBLISHED track sidesteps both: it exists everywhere this
 * suite runs, and a signed-out visitor can always reach it, so no session
 * fixture is needed at all — unlike lesson-reader.spec.ts (whose DRAFT
 * track exists specifically to test the staff-preview gate), nothing here
 * is gated.
 *
 * The track has two modules. Module A is always unlocked (`isModuleUnlocked`
 * treats index 0 as unlocked unconditionally — lib/curriculum-progress.ts).
 * Module B sits at index 1 with no LessonProgress rows for anyone, so
 * module A's rollup is 0%, not 100%, and module B stays locked. That locked
 * state is what the third test exploits: CLAUDE.md is explicit that
 * `unlocked` is advisory only and must never gate a route, so a locked
 * module's lesson links must still work.
 */
const NAMESPACE = "e2e-module-screen"
const RUN_ID = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const PREFIX = `${NAMESPACE}-${RUN_ID}`

const authorEmail = `${PREFIX}-author@example.test`
const trackSlug = `${PREFIX}-track`
const topicSlug = `${PREFIX}-topic`
const lessonASlug = `${PREFIX}-lesson-a`
const lessonBSlug = `${PREFIX}-lesson-b`
const moduleASlug = "module-a"
const moduleBSlug = "module-b"

const MODULE_A_NAME = "E2E Module Screen Foundations"
const MODULE_B_NAME = "E2E Module Screen Advanced"
const LESSON_A_TITLE = "E2E Module Screen Lesson A"
const LESSON_B_TITLE = "E2E Module Screen Lesson B"
const TRACK_NAME = "E2E Module Screen Track"

/**
 * Order matters, same as lesson-reader.spec.ts: articles first (cascades
 * ModuleLesson/LessonCheckpoint/LessonProgress), then the track (cascades
 * its modules), then the topic, then the author (Article.authorId is
 * `onDelete: Restrict`, so it must go last).
 *
 * Every row, including the author, is swept by NAMESPACE prefix rather than
 * an exact match on this run's generated email — that's what makes cleanup
 * crash-recoverable. `authorEmail` embeds RUN_ID, so an exact-match lookup
 * would only ever find *this* run's own user; a process that dies between
 * seedUser() and cleanup() (CI timeout, ctrl-C) would leak that user
 * permanently, since no future run's RUN_ID would ever match it again.
 */
async function cleanup(): Promise<void> {
    await prisma.article.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.track.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.topic.deleteMany({ where: { slug: { startsWith: NAMESPACE } } })
    await prisma.user.deleteMany({ where: { email: { startsWith: NAMESPACE } } })
}

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()

    const author = await seedUser({ email: authorEmail, name: "E2E Module Author" })

    const topic = await prisma.topic.create({
        data: {
            name: `${PREFIX} topic`,
            slug: topicSlug,
            description: "Topic that owns the module-screen fixture articles.",
        },
    })

    const [lessonA, lessonB] = await Promise.all([
        prisma.article.create({
            data: {
                title: LESSON_A_TITLE,
                slug: lessonASlug,
                content: "Lesson A body.",
                summary: "First lesson, in the always-unlocked module.",
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
                summary: "Second lesson, in the locked module.",
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
            summary: "A published track that exists purely for module.spec.ts.",
            description: "Two modules: one always unlocked, one locked behind it.",
            status: "PUBLISHED",
            estimatedMinutes: 20,
            modules: {
                create: [
                    {
                        slug: moduleASlug,
                        name: MODULE_A_NAME,
                        description: "Always unlocked — first module in the track.",
                        position: 0,
                        lessons: { create: [{ articleId: lessonA.id, position: 0 }] },
                    },
                    {
                        slug: moduleBSlug,
                        name: MODULE_B_NAME,
                        description: "Locked until module A reaches 100%.",
                        position: 1,
                        lessons: { create: [{ articleId: lessonB.id, position: 0 }] },
                    },
                ],
            },
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

test.describe("module screen", () => {
    test("renders lessons and keeps the console shell", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/learn/tracks/${trackSlug}/modules/${moduleASlug}`)

        // Normal shell route: footer present, exactly one banner. This is
        // the whole reason the URL is 5 segments (focus-route.ts's
        // isFocusRoute only fires at 4) — a regression here would silently
        // turn this into a focus route with no footer and a bespoke header.
        await expect(page.getByRole("contentinfo")).toHaveCount(1)
        await expect(page.getByRole("banner")).toHaveCount(1)
        const heading = page.getByRole("heading", { level: 1 })
        await expect(heading).toBeVisible()
        await expect(heading).toHaveText(MODULE_A_NAME)

        // Not vacuous: the seeded lesson actually renders as a working link
        // to the reader route, not just an empty shell around a title.
        await expect(
            page.getByRole("link", { name: new RegExp(LESSON_A_TITLE) }),
        ).toHaveAttribute("href", `/learn/tracks/${trackSlug}/${lessonASlug}`)
    })

    test("an unknown module slug renders not-found", async ({ page }) => {
        // notFound() returns HTTP 200 app-wide in this project — Next
        // commits the status before the throw — so assert the body, never
        // the status code.
        await page.goto(`/learn/tracks/${trackSlug}/modules/does-not-exist`)
        await expect(page.getByText(/not found/i).first()).toBeVisible()
    })

    test("a locked module still renders its lesson as a working link", async ({
        page,
    }) => {
        await page.goto(`/learn/tracks/${trackSlug}/modules/${moduleBSlug}`)

        // `unlocked` is advisory (lib/curriculum-progress.ts) and drives only
        // this chip — confirm the page agrees module B is locked, so the
        // link assertion below is proving something, not testing an
        // already-unlocked module by accident.
        await expect(page.getByText(/locked until 01/i)).toBeVisible()

        const lessonLink = page.getByRole("link", {
            name: new RegExp(LESSON_B_TITLE),
        })
        await expect(lessonLink).toHaveAttribute(
            "href",
            `/learn/tracks/${trackSlug}/${lessonBSlug}`,
        )

        // CLAUDE.md: "Never enforce module unlocking" — unlocked must never
        // gate a route. Click through and confirm it actually lands on the
        // lesson rather than being redirected or blocked.
        await lessonLink.click()
        await expect(page).toHaveURL(
            new RegExp(`/learn/tracks/${trackSlug}/${lessonBSlug}$`),
        )
        await expect(page.getByText(/not found/i)).toHaveCount(0)
    })
})

test.describe("track detail page — module branch", () => {
    // Whole-branch review finding: ModuleRow, TrackProgressCard and
    // RulesOfThePath (the module-based curriculum branch of
    // app/learn/tracks/[slug]/page.tsx) had NO e2e coverage at all —
    // tracks.spec.ts only ever seeds a TrackItem-based track, so it only
    // ever exercises the item-based fallback (TrackItemRow, TrackProgressBar,
    // the "Track rhythm" card). That gap is why a stale "resume === null
    // means complete" bug on this same module branch shipped past four
    // individual-task reviews. Reuses this file's own PUBLISHED
    // two-module fixture rather than seeding a second one.
    test("renders module rows, the progress card, and the rules-of-the-path copy", async ({
        page,
    }) => {
        await page.goto(`/learn/tracks/${trackSlug}`)

        await expect(
            page.getByRole("heading", { name: TRACK_NAME }),
        ).toBeVisible()

        // ModuleRow: both modules render as working links to the module
        // route, not the TrackItem fallback's problem-row list.
        await expect(
            page.getByRole("link", { name: new RegExp(MODULE_A_NAME) }),
        ).toHaveAttribute(
            "href",
            `/learn/tracks/${trackSlug}/modules/${moduleASlug}`,
        )
        await expect(
            page.getByRole("link", { name: new RegExp(MODULE_B_NAME) }),
        ).toHaveAttribute(
            "href",
            `/learn/tracks/${trackSlug}/modules/${moduleBSlug}`,
        )

        // TrackProgressCard: module A is the only module under 100% (no
        // LessonProgress rows exist for anyone in this fixture), so it's
        // the "Continue module 01" target — module-rollup-driven, not the
        // item-based Start/Continue/Review card.
        await expect(page.getByText("Track progress")).toBeVisible()
        await expect(
            page.getByRole("link", { name: /continue module 01/i }),
        ).toHaveAttribute(
            "href",
            `/learn/tracks/${trackSlug}/modules/${moduleASlug}`,
        )

        // RulesOfThePath: the user-facing statement of the advisory-unlock
        // rule, replacing the item-based "Track rhythm" card.
        await expect(
            page.getByText(
                /skipping ahead is always allowed — nothing is ever really locked/i,
            ),
        ).toBeVisible()
    })
})
