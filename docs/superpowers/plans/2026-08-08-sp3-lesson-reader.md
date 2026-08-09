# SP3 — Lesson Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three-rail lesson reader — the first visibly-new screen of the redesign, and the only surface that renders SP1's 17 authored lessons.

**Architecture:** A new route `/learn/tracks/[slug]/[lessonSlug]` renders a focus mode: a 270px curriculum rail replaces the console sidebar, under a 48px header, with a 250px contents rail on the right. All navigation maths lives in a pure, database-free module. `#app-scroll` remains the single scroll container — the rails are `sticky` with their own overflow — so `MainScrollRestoration` is untouched. No new Prisma models and no migration.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 over HSL CSS variables, `lucide-react`, `node --import tsx --test` for unit tests, Playwright for e2e.

**Spec:** [`docs/superpowers/specs/2026-08-08-sp3-lesson-reader-design.md`](../specs/2026-08-08-sp3-lesson-reader-design.md)

**Branch:** `feat/sp3-lesson-reader`, cut from `docs/sp3-lesson-reader` so the spec (`b44c34a`) and this plan (`8170cc9`) ride along in the same PR — the pattern SP2 used.

## Global Constraints

- **Never run `next build` without `--webpack`.** Turbopack panics on this codebase in Next 16.1.1. Use `npm run build`.
- **Never use hardcoded Tailwind palette classes** (`bg-slate-800`, `text-green-400`, `bg-white`). Semantic tokens only.
- **Never use raw hex literals in `className` strings.**
- **No emoji icons.** SVG only, via `lucide-react`.
- **Every token declared in `:root` must also be declared in `.light`.** Enforced by `npm run check:token-parity`.
- **`--icon-off` is for non-text glyphs only** and must never colour text. `--text-dim` is the contrast floor for text.
- **`unlocked` is advisory.** It may drive copy only. It must never gate this route, reject an action, or block a checkpoint.
- **Never export a `userId`-parameterised function from a `"use server"` file.** `lib/curriculum-read.ts` and `lib/curriculum-write.ts` stay plain modules; `actions/curriculum.ts` resolves the session and delegates.
- **PR base is `main`, explicitly.** `gh pr create --base main`. The repo default is `production`.
- **Do not touch `.github/workflows/`.** The `gh` token lacks `workflow` scope and the PR would become unmergeable from the CLI. CI wiring is a deliberate follow-up.
- **Indentation is 4 spaces** in `.ts`/`.tsx`.
- **`npm run dev` binds to `.env.local`, which points at production Neon.** Prefix `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn'` for local data.

---

## File Structure

**Created:**

| Path | Responsibility |
|---|---|
| `components/learn/reader/lesson-nav.ts` | Pure: flatten curriculum, resolve slug, neighbours, breadcrumb. No React, no Prisma. |
| `lib/reading-progress.ts` | Pure: scroll → percent, write-bucket decision. No DOM. |
| `components/layout/console/focus-route.ts` | Pure: `isFocusRoute(pathname)` |
| `components/learn/reader/LessonHeader.tsx` | 48px bar; carries the `banner` landmark |
| `components/learn/reader/ReaderProgressProvider.tsx` | Client; owns the scroll listener, the live percent and the progress writes |
| `components/learn/reader/ReadingProgressBar.tsx` | Client; the 2px bar, pure presentation |
| `components/learn/reader/CurriculumRail.tsx` | 270px left rail |
| `components/learn/reader/LessonBody.tsx` | Shared with the topic route; strips the duplicate H1 |
| `components/learn/reader/CheckpointBlock.tsx` | Rendered from `LessonCheckpoint` data, not markdown |
| `components/learn/reader/LessonPrevNext.tsx` | The paired footer cards |
| `components/learn/reader/LessonAsideRail.tsx` | 250px right rail |
| `components/learn/reader/ContentsSheet.tsx` | Mobile bottom sheet + sticky footer |
| `app/learn/tracks/[slug]/[lessonSlug]/page.tsx` | Server component, sole fetcher |
| `scripts/test-lesson-nav.ts` | Unit tests for `lesson-nav.ts` |
| `scripts/test-reading-progress.ts` | Unit tests for `lib/reading-progress.ts` |
| `tests/e2e/lesson-reader.spec.ts` | Playwright coverage; seeds its own track fixture |

**Modified:**

| Path | Change |
|---|---|
| `app/globals.css` | Add `--icon-done` to `:root` and `.light` |
| `lib/curriculum-read.ts` | `allowDraft` option |
| `actions/curriculum.ts` | Resolve staff role, pass `allowDraft` |
| `components/layout/console/ConsoleChrome.tsx` | Own `#app-scroll` / `<main>` / `<Footer>`; honour `isFocusRoute` |
| `app/layout.tsx` | Hand the scroll column to `ConsoleChrome` |
| `app/learn/[topicSlug]/[articleSlug]/page.tsx` | Adopt `LessonBody`; fixes the duplicate `<h1>` |
| `app/learn/tracks/[slug]/page.tsx` | Interim module-grouped lesson list |
| `scripts/test-console-nav.ts` | Widen coverage (handoff follow-up #4) |
| `package.json` | Two new test scripts |

---

## Task 1: Pure lesson navigation

**Files:**
- Create: `components/learn/reader/lesson-nav.ts`
- Create: `scripts/test-lesson-nav.ts`
- Modify: `package.json` (add `test:lesson-nav`)

**Interfaces:**
- Consumes: `TrackCurriculum`, `CurriculumModule`, `CurriculumLesson`, `CurriculumCheckpoint` from `@/lib/curriculum-read`
- Produces: `FlatLesson`, `flattenCurriculum`, `findLesson`, `lessonNeighbors`, `modulePrefix`, `lessonBreadcrumb`

An article may legally appear in two modules of one track (`ModuleLesson`'s `@@id([moduleId, articleId])` permits it). `flattenCurriculum` keeps **both** occurrences — the rail genuinely lists it twice, so the `n / m` counter must count it twice — while `findLesson` deterministically resolves a slug to the occurrence in the **lowest module `position`**.

- [ ] **Step 1: Write the failing test**

```ts
// Unit tests for pure lesson navigation maths. No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-lesson-nav.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    flattenCurriculum,
    findLesson,
    lessonNeighbors,
    modulePrefix,
    lessonBreadcrumb,
} from "../components/learn/reader/lesson-nav"
import type { TrackCurriculum } from "../lib/curriculum-read"

function lesson(slug: string, completed = false) {
    return {
        articleId: `a-${slug}`,
        slug,
        title: slug.replace(/-/g, " "),
        readingMinutes: 4,
        completed,
        checkpoints: [],
    }
}

function fixture(): TrackCurriculum {
    return {
        trackId: "t1",
        slug: "analyst-interview-prep",
        name: "Analyst Interview Prep",
        rollup: {
            lessonsDone: 1, lessonsTotal: 3,
            problemsDone: 0, problemsTotal: 0, percent: 33,
        },
        modules: [
            {
                id: "m1", slug: "foundations", name: "Foundations",
                description: "", position: 0, unlocked: true,
                lessons: [lesson("select-where", true), lesson("null-is-not-a-value")],
                rollup: {
                    moduleId: "m1", lessonsDone: 1, lessonsTotal: 2,
                    problemsDone: 0, problemsTotal: 0, percent: 50,
                },
            },
            {
                id: "m2", slug: "joins", name: "Joins",
                description: "", position: 1, unlocked: false,
                lessons: [lesson("semi-and-anti-joins")],
                rollup: {
                    moduleId: "m2", lessonsDone: 0, lessonsTotal: 1,
                    problemsDone: 0, problemsTotal: 0, percent: 0,
                },
            },
        ],
    }
}

describe("flattenCurriculum", () => {
    it("returns every lesson in track order with a 0-indexed flat index", () => {
        const flat = flattenCurriculum(fixture())
        assert.equal(flat.length, 3)
        assert.deepEqual(
            flat.map((l) => l.slug),
            ["select-where", "null-is-not-a-value", "semi-and-anti-joins"],
        )
        assert.deepEqual(flat.map((l) => l.flatIndex), [0, 1, 2])
    })

    it("carries module identity onto each lesson", () => {
        const flat = flattenCurriculum(fixture())
        assert.equal(flat[2].moduleSlug, "joins")
        assert.equal(flat[2].moduleName, "Joins")
        assert.equal(flat[2].modulePosition, 1)
        assert.equal(flat[2].lessonInModule, 0)
    })

    it("keeps both occurrences when one article sits in two modules", () => {
        const c = fixture()
        c.modules[1].lessons.push(lesson("select-where", true))
        const flat = flattenCurriculum(c)
        assert.equal(flat.length, 4)
        assert.equal(flat.filter((l) => l.slug === "select-where").length, 2)
    })

    it("is empty for a track with no modules", () => {
        const c = fixture()
        c.modules = []
        assert.deepEqual(flattenCurriculum(c), [])
    })
})

describe("findLesson", () => {
    it("resolves a slug to its flat entry", () => {
        const flat = flattenCurriculum(fixture())
        assert.equal(findLesson(flat, "null-is-not-a-value")?.flatIndex, 1)
    })

    it("returns null for an unknown slug", () => {
        assert.equal(findLesson(flattenCurriculum(fixture()), "nope"), null)
    })

    it("resolves to the LOWEST module position when an article is in two", () => {
        const c = fixture()
        c.modules[1].lessons.push(lesson("select-where", true))
        const hit = findLesson(flattenCurriculum(c), "select-where")
        assert.equal(hit?.modulePosition, 0)
        assert.equal(hit?.moduleSlug, "foundations")
    })
})

describe("lessonNeighbors", () => {
    it("gives both neighbours in the middle of a track", () => {
        const flat = flattenCurriculum(fixture())
        const { prev, next } = lessonNeighbors(flat, 1)
        assert.equal(prev?.slug, "select-where")
        assert.equal(next?.slug, "semi-and-anti-joins")
    })

    it("has no prev on the first lesson", () => {
        const { prev, next } = lessonNeighbors(flattenCurriculum(fixture()), 0)
        assert.equal(prev, null)
        assert.equal(next?.slug, "null-is-not-a-value")
    })

    it("has no next on the last lesson", () => {
        const { prev, next } = lessonNeighbors(flattenCurriculum(fixture()), 2)
        assert.equal(prev?.slug, "null-is-not-a-value")
        assert.equal(next, null)
    })

    it("returns both null for an out-of-range index", () => {
        const { prev, next } = lessonNeighbors(flattenCurriculum(fixture()), 99)
        assert.equal(prev, null)
        assert.equal(next, null)
    })
})

describe("modulePrefix", () => {
    it("renders a 0-indexed position as a 1-based 2-digit string", () => {
        assert.equal(modulePrefix(0), "01")
        assert.equal(modulePrefix(3), "04")
    })

    it("does not truncate past nine", () => {
        assert.equal(modulePrefix(11), "12")
    })
})

describe("lessonBreadcrumb", () => {
    it("prefixes the module with its display number", () => {
        const flat = flattenCurriculum(fixture())
        const crumb = lessonBreadcrumb("analyst-interview-prep", flat[2])
        assert.deepEqual(crumb, {
            track: "analyst-interview-prep",
            module: "02-joins",
            lesson: "semi-and-anti-joins",
        })
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/test-lesson-nav.ts`
Expected: FAIL — `Cannot find module '../components/learn/reader/lesson-nav'`

- [ ] **Step 3: Write minimal implementation**

```ts
// Pure lesson-navigation maths over an already-fetched TrackCurriculum.
// NO Prisma, NO React, NO server runtime — so it unit-tests without a
// database. Same contract as lib/curriculum-progress.ts.

import type {
    CurriculumCheckpoint,
    TrackCurriculum,
} from "@/lib/curriculum-read"

export type FlatLesson = {
    articleId: string
    slug: string
    title: string
    readingMinutes: number | null
    completed: boolean
    checkpoints: CurriculumCheckpoint[]
    moduleId: string
    moduleSlug: string
    moduleName: string
    /** 0-indexed, as stored. */
    modulePosition: number
    /** 0-indexed position within its module. */
    lessonInModule: number
    /** 0-indexed position across the whole track. */
    flatIndex: number
}

/**
 * Every lesson in track order.
 *
 * An article may legally appear in two modules of one track —
 * ModuleLesson's @@id([moduleId, articleId]) permits it. Both occurrences
 * are kept: the curriculum rail genuinely lists the lesson under both
 * modules, so the "14 / 37" counter must count it twice. URL resolution
 * is what needs to be deterministic, and that is findLesson's job.
 */
export function flattenCurriculum(curriculum: TrackCurriculum): FlatLesson[] {
    const flat: FlatLesson[] = []
    for (const mod of curriculum.modules) {
        mod.lessons.forEach((lesson, lessonInModule) => {
            flat.push({
                articleId: lesson.articleId,
                slug: lesson.slug,
                title: lesson.title,
                readingMinutes: lesson.readingMinutes,
                completed: lesson.completed,
                checkpoints: lesson.checkpoints,
                moduleId: mod.id,
                moduleSlug: mod.slug,
                moduleName: mod.name,
                modulePosition: mod.position,
                lessonInModule,
                flatIndex: flat.length,
            })
        })
    }
    return flat
}

/**
 * Resolve a lesson slug to its flat entry. When one article sits in two
 * modules, the LOWEST module position wins — deterministic, and
 * reordering cannot change the answer except by changing the intended
 * order. `modules` arrives ordered by position, so the first match is
 * already the lowest.
 */
export function findLesson(
    flat: FlatLesson[],
    slug: string,
): FlatLesson | null {
    return flat.find((lesson) => lesson.slug === slug) ?? null
}

export function lessonNeighbors(
    flat: FlatLesson[],
    index: number,
): { prev: FlatLesson | null; next: FlatLesson | null } {
    if (index < 0 || index >= flat.length) return { prev: null, next: null }
    return {
        prev: index > 0 ? flat[index - 1] : null,
        next: index < flat.length - 1 ? flat[index + 1] : null,
    }
}

/**
 * A module's display number. `position` is 0-indexed in the database; the
 * breadcrumb shows a 1-based, zero-padded number. Derived at render time
 * so reordering never breaks a URL — see the schema comment on
 * Module.slug.
 */
export function modulePrefix(position: number): string {
    return String(position + 1).padStart(2, "0")
}

export function lessonBreadcrumb(
    trackSlug: string,
    lesson: FlatLesson,
): { track: string; module: string; lesson: string } {
    return {
        track: trackSlug,
        module: `${modulePrefix(lesson.modulePosition)}-${lesson.moduleSlug}`,
        lesson: lesson.slug,
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/test-lesson-nav.ts`
Expected: PASS — 15 tests, 0 fail

- [ ] **Step 5: Add the npm script**

In `package.json`, beside `"test:console-nav"`:

```json
"test:lesson-nav": "node --import tsx --test scripts/test-lesson-nav.ts",
```

- [ ] **Step 6: Verify via the npm script and typecheck**

Run: `npm run test:lesson-nav && npx tsc --noEmit`
Expected: PASS, then clean typecheck

- [ ] **Step 7: Commit**

```bash
git add components/learn/reader/lesson-nav.ts scripts/test-lesson-nav.ts package.json
git commit -m "feat(learn): pure lesson-navigation maths for the reader"
```

---

## Task 2: Reading-progress maths

**Files:**
- Create: `lib/reading-progress.ts`
- Create: `scripts/test-reading-progress.ts`
- Modify: `package.json` (add `test:reading-progress`)

**Interfaces:**
- Consumes: nothing
- Produces: `scrollPercent(scrollTop, scrollHeight, clientHeight): number`, `shouldPersist(lastWritten, current): boolean`

The `denom <= 0 → 100` branch is the load-bearing one. **All 17 seeded lessons are 4 or 5 minutes**, so on a tall desktop window a lesson can produce no scrollable distance at all; without this branch a large fraction of the track would be permanently uncompletable and the failure would be silent.

- [ ] **Step 1: Write the failing test**

```ts
// Unit tests for reading-progress maths. No DOM — these are pure numbers.
//
// Run: node --import tsx --test scripts/test-reading-progress.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { scrollPercent, shouldPersist } from "../lib/reading-progress"

describe("scrollPercent", () => {
    it("is 0 at the top of a scrollable article", () => {
        assert.equal(scrollPercent(0, 3000, 800), 0)
    })

    it("is 100 at the bottom of a scrollable article", () => {
        assert.equal(scrollPercent(2200, 3000, 800), 100)
    })

    it("is the ratio of scrolled to scrollable distance in between", () => {
        assert.equal(scrollPercent(1100, 3000, 800), 50)
    })

    it("is 100 when there is nothing to scroll", () => {
        // Every seeded lesson is 4-5 minutes. In a tall window the content
        // fits entirely, so scrollHeight === clientHeight and there is no
        // scrollable distance. Without this branch the lesson could never
        // be completed.
        assert.equal(scrollPercent(0, 800, 800), 100)
    })

    it("is 100 when the viewport is taller than the content", () => {
        assert.equal(scrollPercent(0, 600, 800), 100)
    })

    it("clamps overscroll to 100", () => {
        // iOS rubber-banding reports scrollTop past the maximum.
        assert.equal(scrollPercent(2600, 3000, 800), 100)
    })

    it("clamps negative overscroll to 0", () => {
        assert.equal(scrollPercent(-120, 3000, 800), 0)
    })
})

describe("shouldPersist", () => {
    it("writes when a new ten-percent boundary is crossed", () => {
        assert.equal(shouldPersist(9, 10), true)
        assert.equal(shouldPersist(0, 40), true)
    })

    it("does not write inside the same bucket", () => {
        assert.equal(shouldPersist(10, 19), false)
        assert.equal(shouldPersist(40, 45), false)
    })

    it("writes on reaching 100 from the nineties", () => {
        assert.equal(shouldPersist(95, 100), true)
    })

    it("does not write again once 100 is recorded", () => {
        assert.equal(shouldPersist(100, 100), false)
    })

    it("never writes backwards", () => {
        // The caller keeps a monotonic max, but guard anyway: LessonProgress
        // is documented as never decreasing.
        assert.equal(shouldPersist(60, 20), false)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/test-reading-progress.ts`
Expected: FAIL — `Cannot find module '../lib/reading-progress'`

- [ ] **Step 3: Write minimal implementation**

```ts
// Pure reading-progress maths. No DOM, no React — the caller reads the
// scroll numbers off #app-scroll and hands them here, so this unit-tests
// without a browser.

/**
 * How far through the scrollable distance the reader is, 0-100.
 *
 * When there is no scrollable distance the lesson counts as fully read.
 * This is not a defensive edge case: every seeded lesson is 4-5 minutes,
 * and in a tall window the content fits without scrolling at all. Without
 * this branch those lessons would be permanently uncompletable and the
 * failure would be silent.
 */
export function scrollPercent(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
): number {
    const denom = scrollHeight - clientHeight
    if (denom <= 0) return 100
    const raw = Math.round((scrollTop / denom) * 100)
    return Math.min(100, Math.max(0, raw))
}

/**
 * Whether a progress write is due. Writes fire on ten-percent boundaries,
 * capping a full read at ~10 round trips. Never fires backwards —
 * LessonProgress.percent is documented as monotonic.
 */
export function shouldPersist(lastWritten: number, current: number): boolean {
    if (current <= lastWritten) return false
    return Math.floor(current / 10) > Math.floor(lastWritten / 10)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/test-reading-progress.ts`
Expected: PASS — 12 tests, 0 fail

- [ ] **Step 5: Add the npm script**

```json
"test:reading-progress": "node --import tsx --test scripts/test-reading-progress.ts",
```

- [ ] **Step 6: Commit**

```bash
git add lib/reading-progress.ts scripts/test-reading-progress.ts package.json
git commit -m "feat(learn): reading-progress maths with a zero-scroll completion branch"
```

---

## Task 3: Focus-route predicate, and widen the nav suite

**Files:**
- Create: `components/layout/console/focus-route.ts`
- Modify: `scripts/test-console-nav.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `isFocusRoute(pathname: string): boolean`

This task also closes **handoff follow-up #4**: `scripts/test-console-nav.ts` currently omits `/projects`, `/blogs`, `/community` and `FOOTER_NAV`. That gap already produced a real bug — two tabs marked `aria-current="page"` on `/learn/tracks`. SP3 adds a focus route to the nav model, so closing it here is the same file and the same risk, not scope creep.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test-console-nav.ts`, and add `isFocusRoute` to the imports at the top:

```ts
import { isFocusRoute } from "../components/layout/console/focus-route"

describe("isFocusRoute", () => {
    it("is true for a lesson reader route", () => {
        assert.equal(isFocusRoute("/learn/tracks/analyst-interview-prep/sessionisation"), true)
    })

    it("is FALSE for the track detail page", () => {
        // The near-miss that matters: the track page keeps the console
        // shell. Only the lesson below it is a focus route.
        assert.equal(isFocusRoute("/learn/tracks/analyst-interview-prep"), false)
    })

    it("is false for the tracks index", () => {
        assert.equal(isFocusRoute("/learn/tracks"), false)
    })

    it("is false for a topic article at the same depth", () => {
        assert.equal(isFocusRoute("/learn/sql-basics/joins"), false)
    })

    it("is false for anything deeper than a lesson", () => {
        assert.equal(isFocusRoute("/learn/tracks/a/b/c"), false)
    })

    it("ignores a trailing slash", () => {
        assert.equal(isFocusRoute("/learn/tracks/a/b/"), true)
    })

    it("is false for the site root", () => {
        assert.equal(isFocusRoute("/"), false)
    })
})

describe("nav coverage (handoff follow-up #4)", () => {
    it("marks exactly one primary item active on any known route", () => {
        const routes = [
            "/", "/practice", "/learn", "/learn/tracks",
            "/learn/tracks/analyst-interview-prep",
            "/projects", "/blogs", "/community",
            "/daily", "/lists", "/profile",
        ]
        for (const route of routes) {
            const active = PRIMARY_NAV.filter((item) => isNavItemActive(item, route))
            assert.ok(
                active.length <= 1,
                `${route} marked ${active.length} primary items active: ${active.map((a) => a.key).join(", ")}`,
            )
        }
    })

    it("marks exactly one footer item active on any footer route", () => {
        for (const item of FOOTER_NAV) {
            if (!item.href) continue
            const active = FOOTER_NAV.filter((other) => isNavItemActive(other, item.href!))
            assert.equal(
                active.length, 1,
                `${item.href} marked ${active.length} footer items active`,
            )
        }
    })

    it("has no nav item whose own href is a focus route", () => {
        // A nav entry pointing at a focus route would render a link to a
        // page that suppresses the very nav it was clicked from. Nothing
        // does that today; this guards the invariant as nav grows.
        const all = [...PRIMARY_NAV, ...FOOTER_NAV, ...TAB_BAR]
        for (const item of all) {
            for (const candidate of [item, ...(item.children ?? [])]) {
                if (!candidate.href) continue
                assert.equal(
                    isFocusRoute(candidate.href), false,
                    `nav item "${candidate.key}" points at focus route ${candidate.href}`,
                )
            }
        }
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:console-nav`
Expected: FAIL — `Cannot find module '../components/layout/console/focus-route'`

- [ ] **Step 3: Write minimal implementation**

```ts
// Pure route predicate. No React, no Next imports — so it unit-tests
// alongside nav-model.ts without a DOM.

/**
 * Whether a path is a "focus mode" route — one that replaces the console
 * shell rather than sitting inside it.
 *
 * Today that is exactly the lesson reader: /learn/tracks/<track>/<lesson>.
 * The track page one level up (/learn/tracks/<track>) keeps the shell, so
 * segment count is the discriminator, not a prefix match.
 */
export function isFocusRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)
    return (
        segments.length === 4 &&
        segments[0] === "learn" &&
        segments[1] === "tracks"
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:console-nav`
Expected: PASS — the pre-existing 41 tests plus 10 new, 0 fail

- [ ] **Step 5: Commit**

```bash
git add components/layout/console/focus-route.ts scripts/test-console-nav.ts
git commit -m "feat(ui): focus-route predicate, and widen the nav suite

Closes handoff follow-up #4 — the suite omitted /projects, /blogs,
/community and FOOTER_NAV, the same gap that produced the double
aria-current bug on /learn/tracks."
```

---

## Task 4: Shell opt-out, preserving the banner landmark

**Files:**
- Modify: `components/layout/console/ConsoleChrome.tsx`
- Modify: `app/layout.tsx:83-114`

**Interfaces:**
- Consumes: `isFocusRoute` from Task 3
- Produces: `ConsoleChrome` renders `#app-scroll` itself; on focus routes it renders neither `<header>`, nor `<main>`, nor `<Footer>` — the page supplies its own.

**Why the restructure.** `ConsoleChrome`'s `<header>` is the app's only `banner` landmark; SP2 added it precisely because deleting `Navbar` destroyed that landmark and turned three `getByRole("banner")` e2e tests red. Suppressing the shell on reader routes would destroy it again. The reader's own 48px header cannot reclaim it while root layout wraps every page in `<main>`, because ARIA forbids `banner` inside `main`.

Moving the scroll column into `ConsoleChrome` — which already runs on the client and can read the pathname — lets the reader render its own `<header>` as a sibling of its own `<main>`, inside a plain `<div>`. Landmark count is unchanged at every viewport.

`#app-scroll` keeps its id: `MainScrollRestoration`, `SignInDialog` and `ReportDialog` all reach for it by that name.

- [ ] **Step 1: Rewrite the ConsoleChrome return**

Add the imports:

```ts
import { usePathname } from "next/navigation"
import { Footer } from "@/components/layout/Footer"
import { isFocusRoute } from "./focus-route"
```

Replace the returned JSX with:

```tsx
    const pathname = usePathname()
    const focus = isFocusRoute(pathname)

    return (
        <div className="flex h-dvh overflow-hidden print:block print:h-auto print:overflow-visible">
            {/* On focus routes the shell is suppressed entirely and the page
                supplies its own <header> and <main>. That header is a child
                of #app-scroll — a plain <div> — so it still maps to `banner`,
                and there is still exactly one per viewport.

                This is why #app-scroll and <main> live here rather than in
                app/layout.tsx: a nested layout is always inside root layout's
                <main>, and ARIA forbids `banner` inside `main`. */}
            {!focus && (
                <header className="flex shrink-0 print:hidden">
                    {collapsed ? (
                        <ConsoleRail onToggle={toggle} accountSlot={railAccountSlot} />
                    ) : (
                        <ConsoleSidebar
                            trackProgress={trackProgress}
                            pageLinks={pageLinks}
                            onToggle={toggle}
                            headerSlot={headerSlot}
                        />
                    )}
                    <MobileTabBar
                        signedIn={signedIn}
                        accountSlot={tabBarAccountSlot}
                        signInSlot={signInSlot}
                    />
                </header>
            )}
            <div
                id="app-scroll"
                className={
                    focus
                        ? "flex flex-1 flex-col overflow-y-auto print:overflow-visible"
                        : "flex flex-1 flex-col overflow-y-auto pb-14 lg:pb-0 print:overflow-visible print:pb-0"
                }
            >
                {focus ? (
                    children
                ) : (
                    <>
                        <main
                            id="main-content"
                            tabIndex={-1}
                            className="flex flex-1 flex-col focus:outline-none"
                        >
                            {children}
                        </main>
                        <Footer />
                    </>
                )}
            </div>
            <MainScrollRestoration />
        </div>
    )
```

Note the `pb-14` is dropped on focus routes: it exists to clear the 56px `MobileTabBar`, which focus routes do not render.

- [ ] **Step 2: Simplify app/layout.tsx**

Replace lines 83–114 (the `<ConsoleShell>` block, including the long comment about the scroll column) with:

```tsx
                    {/* The scroll column, <main> and <Footer> live inside
                        ConsoleChrome now — it is the only component that can
                        see the pathname, and focus routes (the lesson reader)
                        need to supply their own <header>/<main> pair to keep
                        the `banner` landmark legal. See ConsoleChrome. */}
                    <ConsoleShell>{children}</ConsoleShell>
```

Remove the now-unused `Footer` import from `app/layout.tsx`.

- [ ] **Step 3: Verify ConsoleShell still passes children through**

Run: `npx tsc --noEmit`
Expected: clean. If `ConsoleShell` typed `children` narrowly, widen it to `React.ReactNode`.

- [ ] **Step 4: Verify landmarks on a normal route**

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev`, open `/practice`, and in the browser console:

```js
document.querySelectorAll("header").length          // 1
document.querySelectorAll("main#main-content").length // 1
document.querySelectorAll("footer").length          // 1
document.querySelector("#app-scroll") !== null      // true
```

Expected: `1`, `1`, `1`, `true` — unchanged from before this task.

- [ ] **Step 5: Run the existing e2e landmark tests**

Run: `npm run test:e2e -- --grep "banner|contentinfo"`
Expected: PASS. These are the tests SP2's review caught; they must stay green.

- [ ] **Step 6: Commit**

```bash
git add components/layout/console/ConsoleChrome.tsx app/layout.tsx
git commit -m "refactor(ui): ConsoleChrome owns the scroll column

Focus routes need their own header/main pair to keep `banner` legal —
ARIA forbids banner inside main, and a nested layout is always inside
root layout's main. Landmark count is unchanged at every viewport."
```

---

## Task 5: Draft preview for staff

**Files:**
- Modify: `lib/curriculum-read.ts`
- Modify: `actions/curriculum.ts`
- Modify: `scripts/test-curriculum-actions.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks
- Produces: `getTrackCurriculumForUser(trackSlug, userId, options?: { allowDraft?: boolean })`; `getTrackCurriculum(trackSlug)` unchanged in signature, now returning DRAFT tracks to staff

`allowDraft` is resolved from the session in `actions/curriculum.ts` and is true for `ADMIN` **or** `MODERATOR` — matching the gate `app/admin/layout.tsx:20` already applies, so draft preview and the admin portal agree on who counts as staff.

`getTrackCurriculumForUser` must **not** gain a `"use server"` directive. It takes an explicit `userId`; exporting it as an action would let any client read any other user's progress.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-curriculum-actions.ts`. **Do not declare a new slug constant** — the file already declares `DRAFT_TRACK_SLUG` (`curricread-draft-track`) at line 18 and seeds/tears down that fixture in its `before`/`after` hooks. Reuse it. A second declaration is a compile error, and pointing the test at the real seeded track would make it depend on seed data.

```ts
describe("getTrackCurriculumForUser draft visibility", () => {
    it("hides a DRAFT track by default", async () => {
        const result = await getTrackCurriculumForUser(DRAFT_TRACK_SLUG, null)
        assert.equal(result, null)
    })

    it("hides a DRAFT track when allowDraft is explicitly false", async () => {
        const result = await getTrackCurriculumForUser(DRAFT_TRACK_SLUG, null, {
            allowDraft: false,
        })
        assert.equal(result, null)
    })

    it("returns a DRAFT track when allowDraft is true", async () => {
        const result = await getTrackCurriculumForUser(DRAFT_TRACK_SLUG, null, {
            allowDraft: true,
        })
        assert.ok(result, "expected the draft track to be returned to staff")
        assert.equal(result.slug, DRAFT_TRACK_SLUG)
        assert.ok(result.modules.length > 0)
    })

    it("still returns null for a slug that does not exist at all", async () => {
        const result = await getTrackCurriculumForUser("no-such-track", null, {
            allowDraft: true,
        })
        assert.equal(result, null)
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:curriculum-actions`
Expected: FAIL — the `allowDraft: true` case returns `null`, because the query is hardcoded to `status: "PUBLISHED"`

- [ ] **Step 3: Implement in lib/curriculum-read.ts**

Change the signature and the `where` clause:

```ts
export async function getTrackCurriculumForUser(
    trackSlug: string,
    userId: string | null,
    options: { allowDraft?: boolean } = {},
): Promise<TrackCurriculum | null> {
    // An unpublished track is invisible to learners. Staff get a preview so
    // a track can be reviewed before the deliberate human act of publishing
    // it — see app/admin/layout.tsx for the matching ADMIN/MODERATOR gate.
    // `findFirst` (not `findUnique`) because `status` makes the where-clause
    // non-unique.
    const track = await prisma.track.findFirst({
        where: {
            slug: trackSlug,
            ...(options.allowDraft ? {} : { status: "PUBLISHED" }),
        },
```

Leave the rest of the query untouched. Note the nested `lessons` filter on `article.status === "PUBLISHED"` stays as-is: all 17 seeded lesson articles are already `PUBLISHED`, and article-level review is a separate concern from track publication.

- [ ] **Step 4: Wire the session in actions/curriculum.ts**

```ts
export async function getTrackCurriculum(trackSlug: string) {
    // `auth()` throws synchronously (not a rejected promise) when called
    // outside a request scope — e.g. from a test harness — so this must be
    // a try/catch, not a `.catch()` chained onto the call.
    let userId: string | null = null
    let allowDraft = false
    try {
        const session = await auth()
        userId = session?.user?.id ?? null
        const role = session?.user?.role
        // Same staff gate as app/admin/layout.tsx, so draft preview and the
        // admin portal agree on who is staff.
        allowDraft = role === "ADMIN" || role === "MODERATOR"
    } catch {
        userId = null
        allowDraft = false
    }
    return getTrackCurriculumForUser(trackSlug, userId, { allowDraft })
}
```

- [ ] **Step 5: Run the tests**

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:curriculum-actions`
Expected: PASS, including the four new cases

- [ ] **Step 6: Verify no server-action leak**

Run: `head -5 lib/curriculum-read.ts`
Expected: no `"use server"` directive. The file must stay a plain module.

- [ ] **Step 7: Commit**

```bash
git add lib/curriculum-read.ts actions/curriculum.ts scripts/test-curriculum-actions.ts
git commit -m "feat(learn): staff preview for DRAFT tracks

allowDraft is resolved from the session in the action and defaults to
false, so the read path stays closed for learners. Publishing remains a
deliberate human action."
```

---

## Task 6: The `--icon-done` token

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `--icon-done`, consumable as `text-icon-done`

The curriculum rail needs a three-way icon distinction: current is vivid (`--primary`), done is a *muted* green that recedes once earned, todo is inert (`--icon-off`). A light done-state cannot reuse `--primary`, or done and current become indistinguishable.

The design handoff gives `#4A8F7B` for dark and **omits the role from its light table entirely**. The light value below is a proposal, flagged unconfirmed exactly as `--accent-violet` is.

- [ ] **Step 1: Add the token to both themes**

In the `:root` block, beside `--icon-off`:

```css
    --icon-done:           163 32% 43%;     /* #4A8F7B completed lesson tick */
```

In the `.light` block, beside its `--icon-off`:

```css
    /* PROPOSED, unconfirmed — the handoff's light table omits this role.
       Keeps the dark hue and saturation, darkened for contrast on white,
       the same move the handoff makes for primary (#4ADE9E -> #0E9F6E).
       Must stay distinguishable from --primary, or done and current
       lessons look identical in the rail. */
    --icon-done:           160 33% 37%;     /* #3F7D68 */
```

- [ ] **Step 2: Expose it to Tailwind**

In the `@theme inline` block, beside the other icon colours:

```css
    --color-icon-done: hsl(var(--icon-done));
```

- [ ] **Step 3: Verify parity**

Run: `npm run check:token-parity`
Expected: exit 0. Adding it to `:root` alone fails this guard by design — confirm that by temporarily commenting out the `.light` line, re-running (expect non-zero exit), then restoring it.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): --icon-done token for completed lessons

Light value is a proposal — the handoff's light table omits the role.
Flagged unconfirmed, same status as --accent-violet."
```

---

## Task 7: Shared lesson body, and the duplicate-H1 fix

**Files:**
- Create: `components/learn/reader/LessonBody.tsx`
- Modify: `app/learn/[topicSlug]/[articleSlug]/page.tsx`

**Interfaces:**
- Consumes: `MarkdownRenderer` from `@/components/markdown/MarkdownRenderer`
- Produces: `LessonBody({ title, summary, content, metaSlot, className })`, and `stripLeadingH1(content: string): string`

**The defect this fixes.** All 17 lesson articles open with a `# Heading` byte-identical to `article.title`, and the topic route already renders `article.title` in its own `<h1>`. Every article page therefore ships two top-level headings today. Verified: 17/17.

- [ ] **Step 1: Write the failing test**

Append to `scripts/test-lesson-nav.ts` (it is the reader's test file and needs no DOM):

```ts
import { stripLeadingH1 } from "../components/learn/reader/LessonBody"

describe("stripLeadingH1", () => {
    it("removes a leading H1", () => {
        const out = stripLeadingH1("# Sessionisation\n\nBody text.")
        assert.equal(out, "Body text.")
    })

    it("removes a leading H1 after blank lines", () => {
        const out = stripLeadingH1("\n\n# Sessionisation\n\nBody text.")
        assert.equal(out, "Body text.")
    })

    it("leaves content without a leading H1 alone", () => {
        const md = "Body text.\n\n## A section"
        assert.equal(stripLeadingH1(md), md)
    })

    it("leaves an H2 alone", () => {
        const md = "## A section\n\nBody."
        assert.equal(stripLeadingH1(md), md)
    })

    it("removes ONLY the first H1, keeping later ones", () => {
        const out = stripLeadingH1("# One\n\nBody.\n\n# Two\n\nMore.")
        assert.equal(out, "Body.\n\n# Two\n\nMore.")
    })

    it("does not strip an H1 that appears after body text", () => {
        const md = "Intro.\n\n# Later heading\n\nBody."
        assert.equal(stripLeadingH1(md), md)
    })

    it("handles empty content", () => {
        assert.equal(stripLeadingH1(""), "")
    })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:lesson-nav`
Expected: FAIL — `Cannot find module '../components/learn/reader/LessonBody'`

- [ ] **Step 3: Write the component**

```tsx
import type { ReactNode } from "react"
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer"
import { cn } from "@/lib/utils"

/**
 * Drop a leading H1 from article markdown.
 *
 * Every authored lesson opens with a `# Heading` byte-identical to
 * `article.title`, and the page renders the title in its own <h1>. Without
 * this, every article ships two top-level headings — which is both an
 * accessibility defect and, in the reader, a visible duplicate.
 *
 * Only a heading at the very start is removed, so a legitimate H1 further
 * down (rare, but valid) survives.
 */
export function stripLeadingH1(content: string): string {
    // `[\r\n]*`, not `\s*`: `\s` would also match the 4-space indent of a
    // CommonMark indented code block, so a document opening with an
    // indented block whose first line began with "# " would silently lose
    // that line.
    return content.replace(/^[\r\n]*#\s+.*(?:\r?\n)+/, "")
}

interface LessonBodyProps {
    title: string
    summary: string | null
    content: string
    /** Mono meta line ABOVE the title — the reader's "Module 4 · Lesson 2". */
    metaSlot?: ReactNode
    /**
     * Slot BELOW the summary, above the body. The topic article route puts
     * its byline/reading-time row and tag chips here, which is where they
     * have always sat. Without this slot the extraction shoves them above
     * the title, so a reader meets the metadata before learning what the
     * article is called.
     */
    belowSummarySlot?: ReactNode
    className?: string
}

/**
 * The reading column, shared by the curriculum reader and the topic
 * article route so both stay typographically identical.
 */
export function LessonBody({
    title,
    summary,
    content,
    metaSlot,
    belowSummarySlot,
    className,
}: LessonBodyProps) {
    return (
        <div className={cn("mx-auto w-full max-w-[76ch]", className)}>
            {metaSlot}
            <h1 className="mt-2 text-[27px] font-semibold leading-tight tracking-[-0.025em] text-foreground lg:text-[34px]">
                {title}
            </h1>
            {summary && (
                <p className="mt-3 text-base leading-[1.55] text-text-muted">
                    {summary}
                </p>
            )}
            {belowSummarySlot}
            <div className="article-body mt-8">
                <MarkdownRenderer
                    content={stripLeadingH1(content)}
                    size="base"
                    withHeadingIds
                />
            </div>
        </div>
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:lesson-nav`
Expected: PASS — 22 tests total, 0 fail

- [ ] **Step 5: Adopt it in the topic route**

In `app/learn/[topicSlug]/[articleSlug]/page.tsx`, replace the `<h1>`, the summary paragraph and the `<MarkdownRenderer>` call with a single `<LessonBody>`, keeping the existing back-link, `Eyebrow` and tag chips exactly as they are. Import `LessonBody` and drop the now-unused `MarkdownRenderer` import.

- [ ] **Step 6: Verify the duplicate heading is gone**

Run the dev server against local data and open `/learn/data-engineering-101/what-is-etl`, then in the console:

```js
document.querySelectorAll("main h1").length   // 1, was 2
```

Expected: `1`.

- [ ] **Step 7: Commit**

```bash
git add components/learn/reader/LessonBody.tsx app/learn/\[topicSlug\]/\[articleSlug\]/page.tsx scripts/test-lesson-nav.ts
git commit -m "fix(learn): strip the duplicate H1 from article bodies

All 17 lesson articles open with a heading identical to article.title,
which the page already renders as its own h1 — so every article page has
shipped two top-level headings. Extracted as LessonBody, shared with the
reader."
```

---

## Task 8: Reading progress provider and bar

**Files:**
- Create: `components/learn/reader/ReaderProgressProvider.tsx`
- Create: `components/learn/reader/ReadingProgressBar.tsx`

**Interfaces:**
- Consumes: `scrollPercent`, `shouldPersist` from `@/lib/reading-progress`; `recordLessonProgress` from `@/actions/curriculum`
- Produces: `ReaderProgressProvider({ articleSlug, initialPercent, signedIn, children })`, `useReaderProgress(): number`, `ReadingProgressBar()`

**Why a provider.** The progress bar lives in the header and the "Read 62% · 3 min left" card lives in the right rail — siblings under a server component, which cannot pass live state between them. One client provider owns the scroll listener and the percent; both surfaces read it. Without this the rail's card would render a frozen number and never flip to "Auto-completed at 100%".

- [ ] **Step 1: Write the provider**

```tsx
"use client"

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { recordLessonProgress } from "@/actions/curriculum"
import { scrollPercent, shouldPersist } from "@/lib/reading-progress"

const ReaderProgressContext = createContext<number>(0)

/** Live read percentage, 0-100. Monotonic within a page view. */
export function useReaderProgress(): number {
    return useContext(ReaderProgressContext)
}

interface ReaderProgressProviderProps {
    articleSlug: string
    /** Server-rendered starting point, so a returning reader resumes. */
    initialPercent: number
    /** Signed-out readers see the bar; nothing persists. */
    signedIn: boolean
    children: React.ReactNode
}

export function ReaderProgressProvider({
    articleSlug,
    initialPercent,
    signedIn,
    children,
}: ReaderProgressProviderProps) {
    const [percent, setPercent] = useState(initialPercent)
    // Refs, not state: these must not trigger re-renders, and the scroll
    // handler needs the latest value without being re-created.
    const maxRef = useRef(initialPercent)
    const writtenRef = useRef(initialPercent)
    const frameRef = useRef<number | null>(null)

    // React honours a useState/useRef initial argument on first mount only.
    // Navigating lesson -> lesson via Prev/Next reconciles this provider in
    // place, so without this reset lesson 2 inherits lesson 1's maxRef — and
    // the monotonic guard below then blocks lesson 2's real progress from
    // ever registering. If lesson 1 was complete, maxRef is 100 and lesson 2
    // can never be completed at all. Silent, and it looks like it works.
    //
    // Keyed on articleSlug ALONE, deliberately: folding this into the effect
    // (whose deps include signedIn) would wipe a reader's progress the moment
    // their sign-in state changed mid-lesson.
    const slugRef = useRef(articleSlug)
    if (slugRef.current !== articleSlug) {
        slugRef.current = articleSlug
        maxRef.current = initialPercent
        writtenRef.current = initialPercent
        setPercent(initialPercent)
    }

    useEffect(() => {
        const scroller = document.getElementById("app-scroll")
        if (!scroller) return

        function persist(value: number) {
            if (!signedIn) return
            writtenRef.current = value
            // Fire-and-forget: a failed progress write must never surface to
            // a reader, and the next boundary retries anyway.
            void recordLessonProgress(articleSlug, value).catch(() => {})
        }

        function measure() {
            frameRef.current = null
            if (!scroller) return
            const next = scrollPercent(
                scroller.scrollTop,
                scroller.scrollHeight,
                scroller.clientHeight,
            )
            if (next <= maxRef.current) return
            maxRef.current = next
            setPercent(next)
            if (shouldPersist(writtenRef.current, next)) persist(next)
        }

        function onScroll() {
            if (frameRef.current !== null) return
            frameRef.current = requestAnimationFrame(measure)
        }

        function onHide() {
            if (document.visibilityState !== "hidden") return
            // Flush what the last boundary missed, so closing the tab
            // mid-lesson does not lose up to 10% of progress.
            if (maxRef.current > writtenRef.current) persist(maxRef.current)
        }

        // Measure once on mount. A lesson short enough not to scroll has no
        // scrollable distance, so scrollPercent returns 100 — but no scroll
        // event will ever fire, and without this call it could never
        // complete. Every seeded lesson is 4-5 minutes, so this is the
        // common path, not an edge case.
        measure()

        scroller.addEventListener("scroll", onScroll, { passive: true })
        document.addEventListener("visibilitychange", onHide)
        return () => {
            scroller.removeEventListener("scroll", onScroll)
            document.removeEventListener("visibilitychange", onHide)
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        }
    }, [articleSlug, signedIn])

    return (
        <ReaderProgressContext.Provider value={percent}>
            {children}
        </ReaderProgressContext.Provider>
    )
}
```

- [ ] **Step 2: Write the bar**

```tsx
"use client"

import { useReaderProgress } from "./ReaderProgressProvider"

/**
 * The 2px bar pinned under the lesson header. Pure presentation — the
 * provider owns the measurement.
 */
export function ReadingProgressBar() {
    const percent = useReaderProgress()

    return (
        <div
            className="absolute inset-x-0 top-full h-0.5 bg-transparent"
            role="progressbar"
            aria-label="Reading progress"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className="h-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                style={{ width: `${percent}%` }}
            />
        </div>
    )
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Commit**

```bash
git add components/learn/reader/ReaderProgressProvider.tsx components/learn/reader/ReadingProgressBar.tsx
git commit -m "feat(learn): reading progress provider and bar

Measures on mount as well as on scroll — every seeded lesson is 4-5
minutes and may not scroll at all, in which case no scroll event ever
fires and the lesson must still complete.

A provider rather than local state because the bar sits in the header
and the lesson-state card sits in the right rail; they are siblings
under a server component and cannot otherwise share live state."
```

---

## Task 9: Curriculum rail

**Files:**
- Create: `components/learn/reader/CurriculumRail.tsx`

**Interfaces:**
- Consumes: `FlatLesson`, `modulePrefix` from `./lesson-nav`; `TrackCurriculum` from `@/lib/curriculum-read`; `--icon-done` from Task 6
- Produces: `CurriculumRail({ curriculum, currentSlug, trackSlug, className })`

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link"
import { Circle, CircleCheck, CircleDot } from "lucide-react"
import type { TrackCurriculum } from "@/lib/curriculum-read"
import { cn } from "@/lib/utils"
import { modulePrefix } from "./lesson-nav"

interface CurriculumRailProps {
    curriculum: TrackCurriculum
    currentSlug: string
    trackSlug: string
    className?: string
}

function StateIcon({ done, current }: { done: boolean; current: boolean }) {
    if (current) {
        return <CircleDot aria-hidden="true" className="size-4 text-primary" />
    }
    if (done) {
        return <CircleCheck aria-hidden="true" className="size-4 text-icon-done" />
    }
    return <Circle aria-hidden="true" className="size-4 text-icon-off" />
}

export function CurriculumRail({
    curriculum,
    currentSlug,
    trackSlug,
    className,
}: CurriculumRailProps) {
    // One article may appear in two modules of the same track. findLesson
    // resolves such a slug to the occurrence in the LOWEST module position;
    // the rail must highlight that same occurrence, or a cross-listed lesson
    // lights up two module headers with two different n/m fractions and
    // announces "current page" twice — the bug class the console-nav suite
    // exists to prevent. `modules` arrives ordered by position, so the first
    // match is the lowest.
    const currentModuleId =
        curriculum.modules.find((mod) =>
            mod.lessons.some((lesson) => lesson.slug === currentSlug),
        )?.id ?? null

    return (
        <nav
            aria-label="Curriculum"
            className={cn(
                "w-[270px] shrink-0 overflow-y-auto border-r border-line bg-panel",
                className,
            )}
        >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Curriculum
                </span>
                <span className="font-mono text-[11px] tabular-nums text-primary">
                    {curriculum.rollup.percent}%
                </span>
            </div>

            <ol className="py-2">
                {curriculum.modules.map((mod) => (
                    <li key={mod.id}>
                        <div className="flex items-center justify-between px-4 pb-1 pt-4">
                            <span
                                className={cn(
                                    "font-mono text-[10px] uppercase tracking-wider",
                                    mod.id === currentModuleId
                                        ? "text-primary"
                                        : "text-text-dim",
                                )}
                            >
                                {modulePrefix(mod.position)} · {mod.name}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                {mod.rollup.lessonsDone}/{mod.rollup.lessonsTotal}
                            </span>
                        </div>

                        <ul>
                            {mod.lessons.map((lesson) => {
                                const current =
                                    lesson.slug === currentSlug &&
                                    mod.id === currentModuleId
                                return (
                                    <li key={`${mod.id}-${lesson.articleId}`}>
                                        <Link
                                            href={`/learn/tracks/${trackSlug}/${lesson.slug}`}
                                            aria-current={current ? "page" : undefined}
                                            className={cn(
                                                "grid grid-cols-[16px_1fr_auto] items-center gap-2.5 border-l-2 py-1.5 pl-3.5 pr-4 transition-colors duration-150",
                                                current
                                                    ? "border-l-primary bg-primary-row"
                                                    : "border-l-transparent hover:bg-panel-hover",
                                            )}
                                        >
                                            <StateIcon
                                                done={lesson.completed}
                                                current={current}
                                            />
                                            <span
                                                className={cn(
                                                    "text-[13px] leading-snug",
                                                    current ? "text-foreground" : "text-text-3",
                                                )}
                                            >
                                                {lesson.title}
                                            </span>
                                            {lesson.readingMinutes !== null && (
                                                <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                                    {lesson.readingMinutes}m
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </li>
                ))}
            </ol>
        </nav>
    )
}
```

Note `aria-current="page"` is set on exactly the current lesson. The nav suite widened in Task 3 exists because this exact property was double-set once before.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 3: Commit**

```bash
git add components/learn/reader/CurriculumRail.tsx
git commit -m "feat(learn): curriculum rail"
```

---

## Task 10: Lesson header

**Files:**
- Create: `components/learn/reader/LessonHeader.tsx`

**Interfaces:**
- Consumes: `FlatLesson`, `lessonBreadcrumb` from `./lesson-nav`; `ReadingProgressBar` from Task 8; `Logo` from `@/components/ui/Logo`
- Produces: `LessonHeader({ trackSlug, lesson, total, prev, next })` — the bar reads its own value from the provider, so the header takes no progress props

**This element carries the `banner` landmark** on focus routes, which is why it is a `<header>` and why the page must render it as a direct child of `#app-scroll` rather than inside `<main>`. See Task 4.

- [ ] **Step 1: Write the component**

```tsx
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Logo } from "@/components/ui/Logo"
import type { FlatLesson } from "./lesson-nav"
import { lessonBreadcrumb } from "./lesson-nav"
import { ReadingProgressBar } from "./ReadingProgressBar"

interface LessonHeaderProps {
    trackSlug: string
    lesson: FlatLesson
    total: number
    prev: FlatLesson | null
    next: FlatLesson | null
}

export function LessonHeader({
    trackSlug,
    lesson,
    total,
    prev,
    next,
}: LessonHeaderProps) {
    const crumb = lessonBreadcrumb(trackSlug, lesson)

    return (
        // Direct child of #app-scroll (a plain div), so this maps to the
        // `banner` landmark that ConsoleChrome's <header> provides on every
        // non-focus route. Exactly one banner per page — see Task 4.
        <header className="sticky top-0 z-30 h-12 shrink-0 border-b border-line bg-panel print:hidden">
            <div className="flex h-full items-center gap-3 px-3">
                <Link href={`/learn/tracks/${trackSlug}`} aria-label="Back to track">
                    <Logo className="size-6" />
                </Link>

                <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                    <ol className="flex items-center gap-1.5 truncate font-mono text-[11px] text-text-dim">
                        <li className="truncate">{crumb.track}</li>
                        <li aria-hidden="true">/</li>
                        <li className="truncate">{crumb.module}</li>
                        <li aria-hidden="true">/</li>
                        <li className="truncate text-foreground">{crumb.lesson}</li>
                    </ol>
                </nav>

                <span className="hidden font-mono text-[11px] tabular-nums text-text-dim sm:inline">
                    {lesson.flatIndex + 1} / {total}
                </span>

                <div className="flex items-center gap-2">
                    {/* aria-label, not just the span: below `sm` the label
                        span is display:none, which removes it from the
                        accessibility tree, and the icon is aria-hidden — so
                        without this the link has NO accessible name at exactly
                        the viewport where only the icon shows (WCAG 4.1.2). */}
                    {prev && (
                        <Link
                            href={`/learn/tracks/${trackSlug}/${prev.slug}`}
                            aria-label="Previous lesson"
                            className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 font-mono text-[11px] text-text-3 transition-colors duration-150 hover:text-foreground"
                        >
                            <ArrowLeft aria-hidden="true" className="size-3" />
                            <span className="hidden sm:inline">Prev</span>
                        </Link>
                    )}
                    {next && (
                        <Link
                            href={`/learn/tracks/${trackSlug}/${next.slug}`}
                            aria-label="Next lesson"
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[11px] text-primary-foreground transition-colors duration-150"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ArrowRight aria-hidden="true" className="size-3" />
                        </Link>
                    )}
                </div>
            </div>

            <ReadingProgressBar />
        </header>
    )
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add components/learn/reader/LessonHeader.tsx
git commit -m "feat(learn): lesson header carrying the banner landmark"
```

---

## Task 11: Checkpoint block and prev/next cards

**Files:**
- Create: `components/learn/reader/CheckpointBlock.tsx`
- Create: `components/learn/reader/LessonPrevNext.tsx`

**Interfaces:**
- Consumes: `CurriculumCheckpoint` from `@/lib/curriculum-read`; `FlatLesson` from `./lesson-nav`
- Produces: `CheckpointBlock({ checkpoints })`, `LessonPrevNext({ trackSlug, prev, next })`

**4 of the 17 lessons have no checkpoint.** The block renders nothing at all for them — no empty card. `CheckpointBlock` returns `null` on an empty array, so the page needs no conditional.

Per-problem pass rate is **not rendered**: it is not stored, `Submission` has no `[problemId, status]` index, and there are 2 submission rows in the database. It is recorded as a follow-up in the spec.

- [ ] **Step 1: Write CheckpointBlock**

```tsx
import Link from "next/link"
import { ChevronRight, Circle, CircleCheck } from "lucide-react"
import type { CurriculumCheckpoint } from "@/lib/curriculum-read"
import { cn } from "@/lib/utils"

const DIFFICULTY_STYLE: Record<CurriculumCheckpoint["difficulty"], string> = {
    EASY: "text-easy",
    MEDIUM: "text-medium",
    HARD: "text-hard",
}

interface CheckpointBlockProps {
    checkpoints: CurriculumCheckpoint[]
}

export function CheckpointBlock({ checkpoints }: CheckpointBlockProps) {
    // 4 of the 17 seeded lessons have no checkpoint. They get nothing —
    // an empty card would be worse than silence.
    if (checkpoints.length === 0) return null

    return (
        <section
            aria-label="Checkpoint"
            className="mt-10 rounded-lg border border-primary-border bg-primary-bg"
        >
            <div className="flex items-center justify-between border-b border-primary-border px-4 py-2.5">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-primary-text">
                    Checkpoint · {checkpoints.length}{" "}
                    {checkpoints.length === 1 ? "problem" : "problems"}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    Counts toward track
                </span>
            </div>

            <ul className="p-2">
                {checkpoints.map((checkpoint) => (
                    <li key={checkpoint.problemId}>
                        <Link
                            href={`/practice/${checkpoint.slug}`}
                            className="grid min-h-11 grid-cols-[16px_1fr_auto_16px] items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-panel-hover"
                        >
                            {checkpoint.solved ? (
                                <CircleCheck aria-hidden="true" className="size-4 text-icon-done" />
                            ) : (
                                <Circle aria-hidden="true" className="size-4 text-icon-off" />
                            )}
                            <span className="text-sm text-foreground">
                                {checkpoint.number}. {checkpoint.title}
                            </span>
                            <span
                                className={cn(
                                    "font-mono text-[10px] uppercase tracking-wider",
                                    DIFFICULTY_STYLE[checkpoint.difficulty],
                                )}
                            >
                                {checkpoint.difficulty}
                            </span>
                            <ChevronRight aria-hidden="true" className="size-4 text-text-dim" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
```

- [ ] **Step 2: Write LessonPrevNext**

```tsx
import Link from "next/link"
import type { FlatLesson } from "./lesson-nav"

interface LessonPrevNextProps {
    trackSlug: string
    prev: FlatLesson | null
    next: FlatLesson | null
}

export function LessonPrevNext({ trackSlug, prev, next }: LessonPrevNextProps) {
    if (!prev && !next) return null

    return (
        <nav
            aria-label="Lesson navigation"
            className="mt-10 grid gap-3 sm:grid-cols-2"
        >
            {prev ? (
                <Link
                    href={`/learn/tracks/${trackSlug}/${prev.slug}`}
                    className="rounded-lg border border-line bg-panel-raised p-4 transition-colors duration-150 hover:border-line-strong"
                >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        ← Previous
                    </span>
                    <p className="mt-1 text-sm text-foreground">{prev.title}</p>
                </Link>
            ) : (
                // Keeps the next card in the right-hand column on the first
                // lesson, rather than letting it slide left.
                <div aria-hidden="true" className="hidden sm:block" />
            )}

            {next && (
                <Link
                    href={`/learn/tracks/${trackSlug}/${next.slug}`}
                    className="rounded-lg border border-primary-border bg-primary-bg p-4 text-right transition-colors duration-150 hover:border-primary"
                >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary-text">
                        Next →
                    </span>
                    <p className="mt-1 text-sm text-foreground">{next.title}</p>
                </Link>
            )}
        </nav>
    )
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add components/learn/reader/CheckpointBlock.tsx components/learn/reader/LessonPrevNext.tsx
git commit -m "feat(learn): checkpoint block and prev/next cards

4 of 17 lessons have no checkpoint — the block renders nothing for them
rather than an empty card. Pass rate is omitted: not stored, unindexed,
and computed from 2 submission rows."
```

---

## Task 12: Right rail and mobile contents sheet

**Files:**
- Create: `components/learn/reader/LessonAsideRail.tsx`
- Create: `components/learn/reader/ContentsSheet.tsx`

**Interfaces:**
- Consumes: `TocEntry` from `@/lib/markdown-toc`; `LinkButton` from `@/components/ui/Button`; `useReaderProgress` from Task 8
- Produces: `LessonAsideRail({ toc, readingMinutes, signedIn, activeSlug })`, `ContentsSheet({ toc, nextHref })`

The lesson-state card reads `useReaderProgress()` rather than taking a `percent` prop, so it tracks the bar live and flips to "Auto-completed at 100%" the moment the reader reaches the end.

The "Asked at" company chips from screenshot `05` are **not built** — no company field or model exists in the schema.

- [ ] **Step 1: Write LessonAsideRail**

```tsx
"use client"

import { CircleCheck, Lock } from "lucide-react"
import { LinkButton } from "@/components/ui/Button"
import type { TocEntry } from "@/lib/markdown-toc"
import { cn } from "@/lib/utils"
import { useReaderProgress } from "./ReaderProgressProvider"

interface LessonAsideRailProps {
    toc: TocEntry[]
    readingMinutes: number | null
    signedIn: boolean
    activeSlug?: string
}

export function LessonAsideRail({
    toc,
    readingMinutes,
    signedIn,
    activeSlug,
}: LessonAsideRailProps) {
    // Live, not a prop: the bar in the header and this card must agree.
    const percent = useReaderProgress()
    const completed = percent >= 100
    const minutesLeft =
        readingMinutes === null
            ? null
            : Math.max(0, Math.round(readingMinutes * (1 - percent / 100)))

    return (
        <aside className="w-[250px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-panel px-3 py-4">
            {toc.length > 0 && (
                <nav aria-label="Contents">
                    <h2 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Contents
                    </h2>
                    <ul className="max-h-[40vh] overflow-y-auto">
                        {toc.map((entry) => (
                            <li key={entry.slug}>
                                <a
                                    href={`#${entry.slug}`}
                                    className={cn(
                                        "block border-l-2 py-1 pl-2.5 text-[13px] transition-colors duration-150",
                                        entry.level === 3 && "pl-5",
                                        entry.slug === activeSlug
                                            ? "border-l-primary bg-panel-raised text-foreground"
                                            : "border-l-transparent text-text-3 hover:text-foreground",
                                    )}
                                >
                                    {entry.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}

            <section className="rounded-lg border border-line bg-panel-raised p-3">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Lesson state
                </h2>
                {completed && (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-primary-text">
                        <CircleCheck aria-hidden="true" className="size-4" />
                        Auto-completed at 100%
                    </p>
                )}
                <p className="mt-1.5 font-mono text-[11px] tabular-nums text-text-dim">
                    Read {percent}%
                    {minutesLeft !== null && ` · ${minutesLeft} min left`}
                </p>
                <div className="mt-2 h-[3px] rounded-full bg-panel-sunken">
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </section>

            {!signedIn && (
                <section className="rounded-lg border border-dashed border-line-strong p-3">
                    <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                        <Lock aria-hidden="true" className="size-3.5" />
                        Not signed in
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                        Reading is free. Sign in to keep the checkmarks and the
                        streak.
                    </p>
                    <LinkButton href="/auth/signin" className="mt-3 w-full" size="sm">
                        Sign in
                    </LinkButton>
                </section>
            )}
        </aside>
    )
}
```

- [ ] **Step 2: Write ContentsSheet**

```tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, List, X } from "lucide-react"
import type { TocEntry } from "@/lib/markdown-toc"

interface ContentsSheetProps {
    toc: TocEntry[]
    nextHref: string | null
}

/**
 * The mobile sticky footer and its contents sheet. Below `lg` the console
 * tab bar is suppressed (this is a focus route), so the footer sits at the
 * true viewport bottom with no offset to clear.
 */
export function ContentsSheet({ toc, nextHref }: ContentsSheetProps) {
    const [open, setOpen] = useState(false)

    return (
        <>
            <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-panel p-2 lg:hidden print:hidden">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    disabled={toc.length === 0}
                    aria-expanded={open}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md border border-line-strong text-sm text-foreground disabled:opacity-40"
                >
                    <List aria-hidden="true" className="size-4" />
                    Contents
                </button>
                {nextHref && (
                    <Link
                        href={nextHref}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-medium text-primary-foreground"
                    >
                        Next lesson
                        <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>
                )}
            </div>

            {open && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <button
                        type="button"
                        aria-label="Close contents"
                        onClick={() => setOpen(false)}
                        className="absolute inset-0 bg-canvas-deep/70"
                    />
                    {/* Deliberately NOT role="dialog". That role asserts a
                        modal contract — focus moved in, trapped, returned on
                        close, Escape to dismiss — and a screen reader will
                        announce "dialog" and then let the user Tab straight
                        out into the page behind. This is a flat list of anchor
                        links with two labelled close buttons: a disclosure,
                        not a modal. Model it honestly rather than hand-rolling
                        a focus trap over a dynamically-sized TOC. Escape-to-
                        close and focus-return are still provided below. */}
                    <div
                        role="region"
                        aria-label="Contents"
                        className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-xl border-t border-line bg-panel-raised p-4"
                    >
                        <div className="mb-3 flex items-center justify-between">
                            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                                Contents
                            </h2>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                aria-label="Close contents"
                                className="text-text-muted"
                            >
                                <X aria-hidden="true" className="size-4" />
                            </button>
                        </div>
                        <ul>
                            {toc.map((entry) => (
                                <li key={entry.slug}>
                                    <a
                                        href={`#${entry.slug}`}
                                        onClick={() => setOpen(false)}
                                        className={`block min-h-11 py-2.5 text-sm text-text-3 ${
                                            entry.level === 3 ? "pl-4" : ""
                                        }`}
                                    >
                                        {entry.text}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </>
    )
}
```

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit`
Expected: clean. If `LinkButton` does not accept `size="sm"`, check its prop union in `components/ui/Button.tsx` and use the nearest valid value.

```bash
git add components/learn/reader/LessonAsideRail.tsx components/learn/reader/ContentsSheet.tsx
git commit -m "feat(learn): right rail and mobile contents sheet

The 'Asked at' card is omitted — no company field exists in the schema."
```

---

## Task 13: The reader page

**Files:**
- Create: `app/learn/tracks/[slug]/[lessonSlug]/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1, 7, 9, 10, 11, 12; `getTrackCurriculum` from `@/actions/curriculum`; `getArticle` from `@/actions/content`; `extractToc` from `@/lib/markdown-toc`; `auth` from `@/lib/auth`
- Produces: the route

The page renders its own `<header>` and `<main id="main-content">` as siblings inside `#app-scroll` — see Task 4. The skip link in `app/layout.tsx` targets `#main-content`, so that id must be present.

- [ ] **Step 1: Write the page**

```tsx
import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { getArticle } from "@/actions/content"
import { getTrackCurriculum } from "@/actions/curriculum"
import { auth } from "@/lib/auth"
import { extractToc } from "@/lib/markdown-toc"
import { CheckpointBlock } from "@/components/learn/reader/CheckpointBlock"
import { ContentsSheet } from "@/components/learn/reader/ContentsSheet"
import { CurriculumRail } from "@/components/learn/reader/CurriculumRail"
import { LessonAsideRail } from "@/components/learn/reader/LessonAsideRail"
import { LessonBody } from "@/components/learn/reader/LessonBody"
import { LessonHeader } from "@/components/learn/reader/LessonHeader"
import { LessonPrevNext } from "@/components/learn/reader/LessonPrevNext"
import { ReaderProgressProvider } from "@/components/learn/reader/ReaderProgressProvider"
import {
    findLesson,
    flattenCurriculum,
    lessonNeighbors,
    modulePrefix,
} from "@/components/learn/reader/lesson-nav"

type Props = {
    params: Promise<{ slug: string; lessonSlug: string }>
}

// Dedup across generateMetadata and the render — both run in the same
// request and would otherwise hit the database twice.
const getCachedArticle = cache(getArticle)
const getCachedCurriculum = cache(getTrackCurriculum)

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { lessonSlug } = await params
    const { data: article } = await getCachedArticle(lessonSlug)
    if (!article) return { title: "Lesson not found" }
    return {
        title: article.title,
        description: article.summary ?? undefined,
        alternates: {
            // The topic route is the canonical address for an article; the
            // reader is the same content in curriculum context.
            canonical: `/learn/${article.topic.slug}/${article.slug}`,
        },
    }
}

export default async function LessonPage({ params }: Props) {
    const { slug, lessonSlug } = await params

    const [curriculum, { data: article }, session] = await Promise.all([
        getCachedCurriculum(slug),
        getCachedArticle(lessonSlug),
        auth().catch(() => null),
    ])

    if (!curriculum || !article) notFound()

    const flat = flattenCurriculum(curriculum)
    const lesson = findLesson(flat, lessonSlug)
    // The article exists and the track exists, but this lesson is not part
    // of this track.
    if (!lesson) notFound()

    const { prev, next } = lessonNeighbors(flat, lesson.flatIndex)
    const toc = extractToc(article.content)
    const signedIn = Boolean(session?.user?.id)
    const isDraft = curriculum.status !== "PUBLISHED"

    return (
        <ReaderProgressProvider
            articleSlug={lessonSlug}
            initialPercent={lesson.completed ? 100 : 0}
            signedIn={signedIn}
        >
            <LessonHeader
                trackSlug={slug}
                lesson={lesson}
                total={flat.length}
                prev={prev}
                next={next}
            />

            <div className="flex min-h-0 flex-1">
                <CurriculumRail
                    curriculum={curriculum}
                    currentSlug={lessonSlug}
                    trackSlug={slug}
                    className="sticky top-12 hidden h-[calc(100dvh-3rem)] xl:block"
                />

                <main
                    id="main-content"
                    tabIndex={-1}
                    className="min-w-0 flex-1 bg-panel-raised px-5 pb-24 pt-8 focus:outline-none sm:px-8 lg:px-14 lg:pb-14"
                >
                    {isDraft && (
                        <p className="mx-auto mb-6 max-w-[76ch] rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[13px] text-warning-text">
                            Draft — not visible to learners.
                        </p>
                    )}

                    <LessonBody
                        title={article.title}
                        summary={article.summary}
                        content={article.content}
                        metaSlot={
                            <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
                                Module {modulePrefix(lesson.modulePosition)} · Lesson{" "}
                                {lesson.lessonInModule + 1}
                                {lesson.readingMinutes !== null && (
                                    <span className="text-text-dim">
                                        {" "}| {lesson.readingMinutes} min
                                    </span>
                                )}
                            </p>
                        }
                    />

                    <div className="mx-auto w-full max-w-[76ch]">
                        <CheckpointBlock checkpoints={lesson.checkpoints} />
                        <LessonPrevNext trackSlug={slug} prev={prev} next={next} />
                    </div>
                </main>

                <LessonAsideRail
                    toc={toc}
                    readingMinutes={lesson.readingMinutes}
                    signedIn={signedIn}
                />
            </div>

            <ContentsSheet
                toc={toc}
                nextHref={next ? `/learn/tracks/${slug}/${next.slug}` : null}
            />
        </ReaderProgressProvider>
    )
}
```

- [ ] **Step 2: Add `status` to the curriculum read**

`isDraft` needs it. In `lib/curriculum-read.ts`, add `status: true` to the track `select`, add `status: TrackStatus` to the `TrackCurriculum` type, and pass it through in the returned object.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean

- [ ] **Step 4: Verify against local data as an admin**

Run the dev server against local Postgres, sign in as an admin, and open:

`/learn/tracks/analyst-interview-prep/over-partition-by-and-frame-clauses`

Confirm by eye: draft banner present; curriculum rail lists 5 modules totalling 17 lessons; the current lesson has a primary left border; header shows `n / 17`; the checkpoint block renders for a lesson that has one and is absent for `sessionisation`, `cohort-retention`, `metric-definitions-that-survive-review` and the fourth checkpoint-less lesson.

Then in the console:

```js
document.querySelectorAll("header").length            // 1
document.querySelectorAll("main#main-content").length // 1
document.querySelectorAll("h1").length                // 1
```

Expected: `1`, `1`, `1`.

- [ ] **Step 5: Verify the learner path is still closed**

Sign out, reload the same URL.
Expected: 404. The track is DRAFT and `allowDraft` is false for anonymous visitors.

- [ ] **Step 6: Commit**

```bash
git add app/learn/tracks/\[slug\]/\[lessonSlug\]/page.tsx lib/curriculum-read.ts
git commit -m "feat(learn): the lesson reader route"
```

---

## Task 14: Interim entry point on the track page

**Files:**
- Modify: `app/learn/tracks/[slug]/page.tsx`

**Interfaces:**
- Consumes: `getTrackCurriculum`, `modulePrefix`

The track page renders `TrackItemRow` over `TrackItem`, and that table has **0 rows** locally — so nothing on the site links to a lesson. This adds a module-grouped list so the reader is reachable and reviewable. It is deliberately functional rather than to the SP4 Module design, which replaces it.

- [ ] **Step 1: Add the module list**

Fetch the curriculum alongside the existing track query and render, below the existing header block:

```tsx
{curriculum && curriculum.modules.length > 0 && (
    <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold text-foreground">Curriculum</h2>
        <ol className="space-y-6">
            {curriculum.modules.map((mod) => (
                <li key={mod.id}>
                    <div className="mb-2 flex items-baseline justify-between">
                        <h3 className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                            {modulePrefix(mod.position)} · {mod.name}
                        </h3>
                        <span className="font-mono text-[11px] tabular-nums text-text-dim">
                            {mod.rollup.lessonsDone}/{mod.rollup.lessonsTotal}
                        </span>
                    </div>
                    <ul className="divide-y divide-line-faint rounded-lg border border-line">
                        {mod.lessons.map((lesson) => (
                            <li key={lesson.articleId}>
                                <Link
                                    href={`/learn/tracks/${slug}/${lesson.slug}`}
                                    className="flex min-h-11 items-center justify-between px-4 py-2.5 transition-colors duration-150 hover:bg-panel-hover"
                                >
                                    <span className="text-sm text-foreground">
                                        {lesson.title}
                                    </span>
                                    {lesson.readingMinutes !== null && (
                                        <span className="font-mono text-[11px] tabular-nums text-text-dim">
                                            {lesson.readingMinutes}m
                                        </span>
                                    )}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </li>
            ))}
        </ol>
    </section>
)}
```

Add a short comment marking it as interim and naming SP4 as its replacement.

- [ ] **Step 2: Verify the round trip**

As an admin, open `/learn/tracks/analyst-interview-prep`, confirm 5 modules and 17 lesson links, click one, and confirm the reader opens with the console shell suppressed.

- [ ] **Step 3: Commit**

```bash
git add app/learn/tracks/\[slug\]/page.tsx
git commit -m "feat(learn): interim module list linking into the reader

TrackItem has 0 rows, so nothing linked to a lesson. SP4's Module screen
replaces this."
```

---

## Task 15: Responsive behaviour

**Files:**
- Modify: `app/learn/tracks/[slug]/[lessonSlug]/page.tsx`
- Modify: `components/learn/reader/LessonAsideRail.tsx`

| Width | Layout |
|---|---|
| ≥1280 (`xl`) | three columns, 270 / 1fr / 250 |
| 1024–1280 | curriculum rail hidden; right rail hidden; single reading column |
| <1024 (`lg`) | single column; sticky footer with Contents + Next lesson |

- [ ] **Step 1: Gate the rails**

The curriculum rail already carries `hidden xl:block` from Task 13. `LessonAsideRail` takes no `className` prop, so set the responsive and sticky classes directly on its root `<aside>`:

```tsx
className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-[250px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-panel px-3 py-4 xl:block"
```

- [ ] **Step 2: Confirm the mobile footer has no tab bar to clear**

`ContentsSheet` is `fixed bottom-0`. Because this is a focus route, `ConsoleChrome` renders no `MobileTabBar` and drops `pb-14` from `#app-scroll` (Task 4), so the footer sits flush at the viewport bottom.

Verify at 390×844 in a device emulator: the footer touches the bottom edge, no 56px gap, and no tab bar is present.

- [ ] **Step 3: Verify each breakpoint**

At 1440, 1200 and 390 wide, confirm the table above. Reading column stays legible at every width; code blocks scroll horizontally rather than wrap.

- [ ] **Step 4: Commit**

```bash
git add app/learn/tracks/\[slug\]/\[lessonSlug\]/page.tsx components/learn/reader/LessonAsideRail.tsx
git commit -m "feat(learn): responsive lesson reader"
```

---

## Task 16: End-to-end coverage, docs, and closing PR #168

**Files:**
- Create: `tests/e2e/lesson-reader.spec.ts`
- Modify: `CLAUDE.md`, `docs/ROADMAP.md`

The suite lives in `tests/e2e/` (see `playwright.config.ts` `testDir`). There is **no `storageState` setup** in this repo: specs seed their own users and set a session cookie through `tests/e2e/fixtures/db.ts`, which exports `prisma`, `seedUser`, `deleteUser`, `sessionCookie` and `SESSION_COOKIE_NAME`. Read `tests/e2e/moderators.spec.ts` first and mirror its structure — run-scoped `PREFIX`, `before`/`after` seeding and cleanup.

The spec **seeds its own track, module, lessons and checkpoint** rather than asserting against `analyst-interview-prep`. Depending on seed data would make the suite fail on any database that has not been seeded, and every other spec in this directory seeds its own fixtures.

- [ ] **Step 1: Write the e2e spec**

Mirror `tests/e2e/moderators.spec.ts` for the harness shape. The fixture must create: a `Track` with `status: "DRAFT"`, one `Module`, two `Article`s with `status: "PUBLISHED"` joined via `ModuleLesson` at positions 0 and 1, and one `LessonCheckpoint` on the first article pointing at an existing published problem. Seed one `ADMIN` user and one plain `USER`.

The assertions to cover:

```ts
test("is not reachable by anonymous visitors while the track is DRAFT", async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    expect(response?.status()).toBe(404)
})

test("renders exactly one banner, one main and one h1", async ({ page }) => {
    await signInAs(page, admin)
    await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    await expect(page.getByRole("banner")).toHaveCount(1)
    await expect(page.getByRole("main")).toHaveCount(1)
    await expect(page.locator("h1")).toHaveCount(1)
})

test("suppresses the console shell", async ({ page }) => {
    await signInAs(page, admin)
    await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    await expect(page.getByRole("navigation", { name: "Curriculum" })).toBeVisible()
    await expect(page.getByRole("contentinfo")).toHaveCount(0)
})

test("marks exactly one lesson as the current page", async ({ page }) => {
    await signInAs(page, admin)
    await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    await expect(page.locator('[aria-current="page"]')).toHaveCount(1)
})

test("navigates to the next lesson", async ({ page }) => {
    await signInAs(page, admin)
    await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    await page.getByRole("link", { name: /next/i }).first().click()
    await expect(page).toHaveURL(new RegExp(`/learn/tracks/${trackSlug}/${lessonTwoSlug}`))
})

test("the lesson-state card tracks the progress bar", async ({ page }) => {
    await signInAs(page, admin)
    await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    const bar = page.getByRole("progressbar", { name: "Reading progress" })
    await page.evaluate(() => {
        const el = document.getElementById("app-scroll")!
        el.scrollTop = el.scrollHeight
    })
    await expect(bar).toHaveAttribute("aria-valuenow", "100")
    // The card and the bar share one provider; a frozen card here means
    // the provider was bypassed.
    await expect(page.getByText("Auto-completed at 100%")).toBeVisible()
})

test("a signed-in non-staff user gets 404 on the draft track", async ({ page }) => {
    await signInAs(page, learner)
    const response = await page.goto(`${BASE_URL}/learn/tracks/${trackSlug}/${lessonOneSlug}`)
    expect(response?.status()).toBe(404)
})
```

`signInAs` sets the session cookie via `sessionCookie(user)` and `SESSION_COOKIE_NAME` on the browser context — copy the exact call shape from `tests/e2e/moderators.spec.ts`, which already does this.

- [ ] **Step 2: Run it**

Run: `npm run test:e2e -- lesson-reader`
Expected: PASS. If the anonymous 404 test fails, the draft gate regressed — fix before proceeding.

- [ ] **Step 3: Run every guard**

```bash
npm run test:lesson-nav
npm run test:reading-progress
npm run test:console-nav
npm run test:scroll-restoration
npm run test:curriculum-progress
npm run check:token-parity
./scripts/check-shadcn-token-definitions.sh
npx tsc --noEmit
npm run build
```

Expected: all pass. Verify the guard scripts under a bare shell too, since `rg` is not on `sh`'s PATH here:

```bash
env -i PATH=/usr/bin:/bin /bin/sh -c './scripts/check-token-theme-parity.sh; echo "exit=$?"'
```

- [ ] **Step 4: Update the docs**

In `CLAUDE.md`, under "Project shape", add `components/learn/reader/` to the components list, and add the two new test scripts to the verification list. Add a "Things to avoid" entry:

> - **Don't render page content outside `<main>` on non-focus routes.** `ConsoleChrome` owns `#app-scroll`, `<main id="main-content">` and `<Footer>`. Focus routes (`isFocusRoute`, today only the lesson reader) opt out and must supply their own `<header>` + `<main id="main-content">` pair — ARIA forbids `banner` inside `main`, which is why the header cannot simply live in the page body of a normal route.

In `docs/ROADMAP.md`, move the lesson reader to shipped.

- [ ] **Step 5: Commit and open the PR**

```bash
git add CLAUDE.md docs/ROADMAP.md tests/e2e/lesson-reader.spec.ts
git commit -m "test(e2e): lesson reader coverage, and document the focus-route contract"
git push -u origin feat/sp3-lesson-reader
gh pr create --base main --title "feat(learn): SP3 lesson reader" --body "..."
```

The PR body follows `.github/PULL_REQUEST_TEMPLATE.md`: Summary / Verified / Not yet verified, with screenshots at 1440 and 390 in both themes.

- [ ] **Step 6: Close PR #168**

```bash
gh pr close 168 --comment "Superseded by SP3 (#<new>). Its intent is carried forward in docs/superpowers/specs/2026-08-08-sp3-lesson-reader-design.md — body line-height, the 450 weight, softened body colour, scrollable TOC and tabular-nums percentage are all in the reader spec, re-expressed against SP2's graphite tokens. Its globals.css hunk targeted the pre-SP2 palette and is not carried over."
```

---

## Self-Review

**Spec coverage.** Every section of the spec maps to a task: routes and shell → 4, 13; module-not-in-URL and two-module resolution → 1; interim spine → 14; draft preview → 5; progress model → 2, 8; responsive → 15; block scope and the H1 fix → 7; `--icon-done` → 6; dropped unbacked elements → 11, 12 (documented in the commit bodies); testing → 1, 2, 3, 16; PR #168 → 16.

**Known follow-ups this plan does not close**, matching the spec: light `--icon-done` confirmation, the query+result content proposal, company data, pass-rate storage, publishing the track, and SP4 replacing Task 14's interim list.

**Two discoveries during planning that amend the spec's phrasing.**

1. The spec said `isFocusRoute` would be "consumed by `ConsoleChrome` and by `Footer`". Task 4 is more specific: `Footer` moves *inside* `ConsoleChrome` rather than reading the predicate itself, because the `banner` landmark forces `#app-scroll` and `<main>` to move there too. Same architecture, one fewer consumer.

2. The spec's component list has `ReadingProgressBar` owning the scroll listener. That cannot work: the bar renders in the header and the "Read 62% · 3 min left" card renders in the right rail, and they are siblings under a server component with no way to share live state. Task 8 splits it into `ReaderProgressProvider` (owns the listener, the percent and the writes) and a presentational `ReadingProgressBar`. Without the split the rail's card would render a frozen server value and never flip to "Auto-completed at 100%" — a bug that looks like working software.

**Sequencing note.** Tasks 1, 2, 3 and 6 are pure and independent — they can be done in any order or in parallel. Task 4 must precede 13. Task 7 must precede 13. Task 13 must precede 14 and 15.
