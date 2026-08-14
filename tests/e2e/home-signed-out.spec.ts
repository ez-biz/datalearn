import { expect, test } from "@playwright/test"
import { prisma } from "./fixtures/db"

/**
 * The signed-out home — `/` for an anonymous visitor, rendered by the
 * anonymous branch of `app/page.tsx`: `Hero` + `PathPreview` in the hero
 * section, then the static `HowItWorks` and `Proof` sections.
 *
 * `PathPreview` (components/home/marketing/PathPreview.tsx) has three
 * rendering branches, keyed off `tracks[0]` (the same track Hero's primary
 * CTA links to):
 *
 *   1. `tracks[0]` has modules -> `moduleRows()`. This is local dev's shape
 *      — local Postgres carries the seeded `analyst-interview-prep` track
 *      (5 modules) via `seed-analyst-track.ts`.
 *   2. `tracks[0]` has zero modules but published tracks exist ->
 *      `trackRows()`. This is production's shape: every published track on
 *      production today is `TrackItem`-based, zero `Module` rows anywhere.
 *      A track carrying items but no modules is exactly the shape that
 *      broke the tracks INDEX pre-v0.9.1 (fixed in 6968fbb) — it reported
 *      "No lessons yet" over a track whose own page listed a full study
 *      sequence. This branch of the signed-out home had never been
 *      rendered or screenshotted before this file.
 *   3. No published tracks at all -> `PathPreview` returns `null`.
 *
 * This file's fixture is a single published, zero-module, two-item track
 * with `createdAt` pinned far in the future so it always sorts first
 * (`getTrackSummariesForUser`'s `orderBy: [{ createdAt: "desc" }, ...]`) —
 * deterministically forcing branch 2 without touching any ambient Track
 * row. Locally this means the fixture shares the render with the ambient
 * `analyst-interview-prep` track (tracks[1], a `moduleRows`-shaped track);
 * that's fine, every assertion below is scoped to the fixture's own row.
 * In CI (test.yml seeds no curriculum — see prisma/seed.ts / seed:visual),
 * the fixture is the only published track, so it's also the only row.
 *
 * No ambient data is read, flipped, or otherwise mutated anywhere in this
 * file — only rows whose slug/schema-name is prefixed with PREFIX are
 * created and torn down. See tests/e2e/home-signed-in.spec.ts's file doc
 * comment for why: an earlier task in this sub-project snapshotted +
 * flipped + `finally`-restored ambient tracks, which was rejected because
 * `finally` never runs on a killed process, silently stranding a
 * developer's real curriculum in DRAFT.
 */
const PREFIX = "e2e-home-signed-out-"
const TRACK_SLUG = `${PREFIX}track`
const TRACK_NAME = "E2E Signed-Out Path Track"
const TRACK_SUMMARY =
    "A published, module-free track that exists purely for home-signed-out.spec.ts."
const FIRST_PROBLEM_SLUG = `${PREFIX}problem-1`
const SECOND_PROBLEM_SLUG = `${PREFIX}problem-2`

test.describe.configure({ mode: "serial" })

test.beforeAll(async () => {
    await cleanup()

    const schema = await prisma.sqlSchema.create({
        data: {
            name: `${PREFIX}schema`,
            sql: "CREATE TABLE t (id INTEGER);",
        },
    })

    const max = await prisma.sQLProblem.aggregate({ _max: { number: true } })
    let next = (max._max.number ?? 0) + 50_000
    const baseProblem = {
        description: "E2E signed-out home problem description",
        schemaDescription: "E2E signed-out home schema description",
        schemaId: schema.id,
        expectedOutput: "[]",
        status: "PUBLISHED" as const,
        dialects: ["DUCKDB" as const],
    }

    const firstProblem = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: FIRST_PROBLEM_SLUG,
            title: "E2E Signed-Out Home First Problem",
            difficulty: "EASY",
        },
    })
    const secondProblem = await prisma.sQLProblem.create({
        data: {
            ...baseProblem,
            number: next++,
            slug: SECOND_PROBLEM_SLUG,
            title: "E2E Signed-Out Home Second Problem",
            difficulty: "MEDIUM",
        },
    })

    await prisma.track.create({
        data: {
            slug: TRACK_SLUG,
            name: TRACK_NAME,
            summary: TRACK_SUMMARY,
            description: "Two items, zero modules — the production shape.",
            difficulty: "EASY",
            status: "PUBLISHED",
            estimatedMinutes: 20,
            // Pinned far in the future so this fixture always sorts as
            // tracks[0] regardless of what else is PUBLISHED (ambient local
            // curriculum, or any other track created earlier in a CI run) —
            // deterministically selects PathPreview's trackRows() branch
            // without mutating a single ambient row.
            createdAt: new Date("2099-01-01T00:00:00.000Z"),
            items: {
                create: [
                    { problemId: firstProblem.id, position: 0 },
                    { problemId: secondProblem.id, position: 1 },
                ],
            },
        },
    })
})

test.afterAll(async () => {
    await cleanup()
    await prisma.$disconnect()
})

async function cleanup(): Promise<void> {
    await prisma.track.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sQLProblem.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await prisma.sqlSchema.deleteMany({ where: { name: { startsWith: PREFIX } } })
}

test("hero primary CTA links to a real, published track — not a dead route", async ({
    page,
}) => {
    await page.goto("/")

    const cta = page.getByRole("link", { name: "Start the path" })
    const href = await cta.getAttribute("href")

    // Never the two dead-link shapes Hero falls back to when it has no
    // featured track: a literal "#", or the bare tracks index (that's the
    // `firstTrackSlug === null` fallback — see Hero.tsx). Our fixture
    // guarantees a real tracks[0], so neither fallback should fire.
    expect(href).not.toBe("#")
    expect(href).not.toBe("/learn/tracks")
    expect(href).toBe(`/learn/tracks/${TRACK_SLUG}`)

    await cta.click()

    // Real destination, not notFound() (which renders HTTP 200 app-wide —
    // assert on the body, never the status).
    await expect(
        page.getByRole("heading", { level: 1, name: TRACK_NAME })
    ).toBeVisible()
    await expect(
        page.getByRole("heading", { name: /page not found/i })
    ).toHaveCount(0)
})

test("with the featured track carrying items but no modules, the path preview lists real tracks instead of rendering empty", async ({
    page,
}) => {
    await page.goto("/")

    // PathPreview returns null (renders nothing at all) whenever its rows
    // array is empty. If branch selection were wrong — e.g. it tried
    // moduleRows() on our zero-module fixture, which maps to an empty
    // array — the whole card would vanish and this heading would not
    // exist. Its presence is the branch-2 discriminator.
    await expect(page.getByText("Your path · preview")).toBeVisible()
    await expect(
        page.getByRole("heading", { name: "Prerequisite order" })
    ).toBeVisible()

    // The fixture's own row: real name, real summary, a real non-zero
    // problem count, and "Start" (index 0), not "Locked" or a lessons
    // clause (trackRows() never emits one — see PathPreview.tsx).
    const row = page.getByRole("link", { name: new RegExp(TRACK_NAME) })
    await expect(row).toHaveAttribute("href", `/learn/tracks/${TRACK_SLUG}`)
    await expect(row).toContainText(TRACK_NAME)
    await expect(row).toContainText(TRACK_SUMMARY)
    await expect(row).toContainText("2P")
    await expect(row).toContainText("Start")

    // No "0 lessons"/"0L" clause anywhere on the row, and no loading
    // skeleton — this is a server-rendered marketing page, not a client
    // fetch, so there is never a legitimate loading state to show.
    await expect(row).not.toContainText("0L")
    await expect(page.locator(".animate-pulse")).toHaveCount(0)
})

test("with lessons at zero, the hero strip omits the lessons clause instead of rendering '0 lessons'", async ({
    page,
}) => {
    // Hero.tsx's STAT_TILES (Problems/Topics/Articles/Tracks) is NOT the
    // right axis for this assertion — none of those four counts can ever
    // be 0 in this suite: problems/topics/articles come from prisma/seed.ts
    // (always non-empty), and tracks is guaranteed >= 1 by this file's own
    // fixture. An assertion that can never be false proves nothing. The
    // axis that actually goes to 0 is STRIP_CLAUSES's "lessons" —
    // app/page.tsx's `totalLessons` is `tracks.reduce((s,t) =>
    // s+t.lessonsTotal, 0)`, a sum across every PUBLISHED track, and
    // production ships zero ModuleLesson rows anywhere (the whole reason
    // this drop-if-zero rule exists at all).
    //
    // That sum is page-wide, not scoped to this file's zero-module
    // fixture — a *different* PUBLISHED, module-bearing track elsewhere
    // (e.g. local Postgres's ambient `analyst-interview-prep`, 17 real
    // lessons) would legitimately push the total above 0 and falsify this
    // test's premise. Detect, don't assume: same pattern as
    // home-signed-in.spec.ts's test 1 — skip locally when such a track is
    // present, fail loudly in CI (test.yml seeds no curriculum at all, so
    // finding one there means that assumption broke).
    const ambientLessonTracks = await prisma.track.findMany({
        where: {
            status: "PUBLISHED",
            slug: { not: { startsWith: PREFIX } },
            modules: {
                some: { lessons: { some: { article: { status: "PUBLISHED" } } } },
            },
        },
        select: { slug: true },
    })

    if (ambientLessonTracks.length > 0) {
        const found = ambientLessonTracks.map((t) => t.slug).join(", ")
        if (process.env.CI) {
            throw new Error(
                `CI is expected to seed no curriculum (see .github/workflows/test.yml), ` +
                    `but found ${ambientLessonTracks.length} PUBLISHED, lesson-bearing ` +
                    `track(s) (${found}). This test's "lessons total is 0" premise depends ` +
                    `on that assumption — investigate what started seeding curriculum data ` +
                    `in CI before trusting this test's pass/fail again.`
            )
        }
        test.skip(
            true,
            `skipped: ${ambientLessonTracks.length} published, lesson-bearing track(s) ` +
                `present (${found}); this assertion requires every published track's ` +
                `lesson total to be 0, which only CI's curriculum-free database guarantees.`
        )
    }

    await page.goto("/")

    const heading = page.getByRole("heading", { level: 1 })
    const strip = heading.locator("xpath=preceding-sibling::p[1]")
    await expect(strip).toBeVisible()
    await expect(strip).not.toContainText(/lesson/i)
})
