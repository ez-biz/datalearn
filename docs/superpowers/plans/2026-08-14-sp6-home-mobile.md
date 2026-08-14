# SP6 Home and Mobile Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild both home screens to the design, and give the workspace a real mobile layout — the segmented Problem/Code/Result view SP5 deferred here by name.

**Architecture:** Every curriculum-dependent block degrades to an honest alternative, because production has zero modules and zero lessons. Decision logic — weak spots, today's plan — lives in pure modules under `lib/home/` so it unit-tests without a DOM. The mobile workspace keeps all three panes mounted and toggles visibility with CSS, so Monaco mounts once and survives switching. No schema changes.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 + PostgreSQL, Tailwind v4 with HSL token variables, Monaco, `node --import tsx --test` for unit suites, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-14-sp6-home-mobile-design.md`

## Global Constraints

- **Four phases, four PRs, each `gh pr create --base main`.** The default branch is `production`; a forgotten `--base` deploys unfinished work to live.
- **Every new test script gets its line in `.github/workflows/test.yml` in the same PR that adds it.** Not a follow-up.
- **Zero migrations.** If a task seems to need one, stop — an omitted design block has crept back in.
- **The fallback rule:** a block that would render zero or empty either shows its honest alternative or does not render. Production has **0 modules and 0 lessons**; local has 5 and 17. Never assume the local shape.
- **Judge suites by exit code, never by grepping output.** Local is Node 26 (`ℹ pass 51`), CI is Node 20 (`# pass 51`).
- **Do not use `fs.globSync`** — Node 22+, and CI pins Node 20.
- **Semantic tokens only.** `npm run check:token-parity` and `npm run check:theme-utilities` must both exit 0; the latter catches a token with no `@theme inline` utility mapping.
- **No emoji.** Lucide SVG only.
- **`npm run build`, never bare `next build`.**
- **No `"use server"` directive on any `lib/` read taking a `userId`** — every export of such a module is a client-callable RPC endpoint.
- **Never pass `Date.now()` or a bare `new Date()` into a unit test.** `buildHeatmap(dates, windowDays, today)` takes an explicit `today` for exactly this reason.
- **`npm run test:e2e` serves the last `npm run build`.** Rebuild before testing UI.
- **Playwright reuses a running server.** When changing `DATABASE_URL`, `lsof -ti :3100 | xargs kill -9` first.
- **CI seeds no curriculum.** Any test needing tracks/modules/lessons must create its own fixture; `tests/e2e/module.spec.ts` shows the prefix-and-cleanup pattern.

## Capability inventory

Behaviours that exist today, appear in **no** design screen, and would vanish silently. Task 11 walks this table.

| Capability | Lives in |
|---|---|
| New-user hero for a learner with no submissions | `components/home/UserHome.tsx` (502 lines) |
| Progress-by-difficulty breakdown | `UserHome.tsx` |
| "Recommended next" first-unsolved card | `UserHome.tsx` |
| Featured problems + topics on the anonymous page | `app/page.tsx` (321 lines) |
| **`tests/e2e/daily.spec.ts` asserts the Daily problem card on `/`** | existing e2e — must keep passing |
| `MobileTabBar` / `MobileSignInMenu` | must survive the Phase 4 clamp change |
| Workspace `⌘↵` Run / `⌘⇧↵` Submit, truncation warning, timeout recovery | `EditorPane` / `ResultsPane` — Phase 4 must not disturb them |

---

## Phase 1 — Pure logic and the home read

PR title: `feat(home): add weak-spots and today's-plan logic`

No UI. This is where the degraded-path tests live, so the rest of SP6 builds on tested foundations.

### File Structure

- Create: `lib/home/weak-spots.ts` — per-tag pass rate. Pure.
- Create: `lib/home/today-plan.ts` — the three-row plan. Pure.
- Create: `lib/home/home-read.ts` — the narrow per-user read. Prisma.
- Create: `scripts/test-weak-spots.ts`, `scripts/test-today-plan.ts`

---

### Task 1: Weak spots

**Files:**
- Create: `lib/home/weak-spots.ts`
- Test: `scripts/test-weak-spots.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Consumes: nothing — pure, no Prisma, no React.
- Produces:

```ts
export type TaggedSubmission = {
    accepted: boolean
    /** Topic tag slugs on the problem this submission was for. */
    tags: Array<{ slug: string; name: string }>
}

export type WeakSpot = {
    slug: string
    name: string
    attempts: number
    accepted: number
    /** Whole percent, 0-100. */
    passRate: number
    /** Drives the bar colour. */
    band: "weak" | "mixed" | "strong"
}

/** Minimum attempts before a tag is judged at all. */
export const MIN_ATTEMPTS = 3

export function computeWeakSpots(
    submissions: TaggedSubmission[],
    limit?: number
): WeakSpot[]
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-weak-spots.ts`:

```ts
// Unit tests for the home dashboard's weak-spots computation.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-weak-spots.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    MIN_ATTEMPTS,
    computeWeakSpots,
    type TaggedSubmission,
} from "../lib/home/weak-spots"

function sub(accepted: boolean, ...tags: string[]): TaggedSubmission {
    return {
        accepted,
        tags: tags.map((slug) => ({ slug, name: slug.replace(/-/g, " ") })),
    }
}

/** n submissions on one tag, `ok` of them accepted. */
function runs(tag: string, n: number, ok: number): TaggedSubmission[] {
    return Array.from({ length: n }, (_, i) => sub(i < ok, tag))
}

describe("computeWeakSpots", () => {
    it("returns nothing when there are no submissions", () => {
        assert.deepEqual(computeWeakSpots([]), [])
    })

    it("ignores a tag with fewer than MIN_ATTEMPTS", () => {
        // One bad attempt does not make a weak spot. Judging a tag on a
        // single submission would put a random topic at the top of the card.
        const out = computeWeakSpots(runs("joins", MIN_ATTEMPTS - 1, 0))
        assert.deepEqual(out, [])
    })

    it("includes a tag once it reaches MIN_ATTEMPTS", () => {
        const out = computeWeakSpots(runs("joins", MIN_ATTEMPTS, 0))
        assert.equal(out.length, 1)
        assert.equal(out[0].slug, "joins")
        assert.equal(out[0].attempts, MIN_ATTEMPTS)
    })

    it("computes pass rate as accepted over attempts", () => {
        const out = computeWeakSpots(runs("joins", 4, 1))
        assert.equal(out[0].accepted, 1)
        assert.equal(out[0].passRate, 25)
    })

    it("orders weakest first", () => {
        const out = computeWeakSpots([
            ...runs("easy-tag", 4, 4),
            ...runs("hard-tag", 4, 1),
        ])
        assert.deepEqual(out.map((w) => w.slug), ["hard-tag", "easy-tag"])
    })

    it("breaks a pass-rate tie by attempts, most-attempted first", () => {
        // Same rate, but the tag you have struggled with more often is the
        // more useful thing to drill.
        const out = computeWeakSpots([
            ...runs("few", 4, 2),
            ...runs("many", 8, 4),
        ])
        assert.deepEqual(out.map((w) => w.slug), ["many", "few"])
    })

    it("counts a submission once per tag it carries", () => {
        const out = computeWeakSpots([
            sub(false, "joins", "windows"),
            sub(false, "joins", "windows"),
            sub(true, "joins", "windows"),
        ])
        assert.deepEqual(out.map((w) => w.attempts), [3, 3])
    })

    it("bands by pass rate", () => {
        const weak = computeWeakSpots(runs("a", 10, 2))[0]
        const mixed = computeWeakSpots(runs("b", 10, 6))[0]
        const strong = computeWeakSpots(runs("c", 10, 9))[0]
        assert.equal(weak.band, "weak")
        assert.equal(mixed.band, "mixed")
        assert.equal(strong.band, "strong")
    })

    it("honours the limit", () => {
        const out = computeWeakSpots(
            [...runs("a", 4, 0), ...runs("b", 4, 1), ...runs("c", 4, 2)],
            2
        )
        assert.equal(out.length, 2)
    })

    it("never rounds a non-perfect rate to 100", () => {
        // 99/100 must not read as mastery.
        const out = computeWeakSpots(runs("a", 100, 99))
        assert.equal(out[0].passRate, 99)
    })

    it("does not mutate the input", () => {
        const input = runs("a", 4, 2)
        const before = input.length
        computeWeakSpots(input)
        assert.equal(input.length, before)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test scripts/test-weak-spots.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/home/weak-spots.ts`. Rules in order:

1. Bucket submissions by tag slug; a submission with two tags counts once toward each.
2. Drop any tag with `attempts < MIN_ATTEMPTS` (3).
3. `passRate = Math.round((accepted / attempts) * 100)`, clamped so a non-perfect rate never reads 100 and a non-zero rate never reads 0 — reuse the clamping approach in `lib/workspace/pass-rate.ts`.
4. Bands: `weak` under 50, `mixed` 50–79, `strong` 80 and above.
5. Sort ascending by `passRate`, then descending by `attempts`, then by slug for stability.
6. Apply `limit` if given. Never mutate the input.

- [ ] **Step 4: Wire and verify**

`package.json`, after `test:approach-sort`:

```json
"test:weak-spots": "node --import tsx --test scripts/test-weak-spots.ts",
```

`.github/workflows/test.yml`, after the `Test approach sort` step:

```yaml
      - name: Test weak spots
        run: npm run test:weak-spots
```

Run: `npm run test:weak-spots`
Expected: PASS, exit 0, 11 tests.

Run: `npx --yes js-yaml .github/workflows/test.yml > /dev/null && echo "yaml ok"`
Expected: `yaml ok`

- [ ] **Step 5: Commit**

```bash
git add lib/home/weak-spots.ts scripts/test-weak-spots.ts package.json .github/workflows/test.yml
git commit -m "feat(home): add the weak-spots computation"
```

---

### Task 2: Today's plan

**Files:**
- Create: `lib/home/today-plan.ts`
- Test: `scripts/test-today-plan.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Consumes: nothing — pure.
- Produces:

```ts
export type PlanRow = {
    kind: "lesson" | "daily" | "problem"
    title: string
    /** Mono meta line, e.g. "Module 04 · Lesson 2" or "Daily · Medium". */
    meta: string
    href: string
    done: boolean
}

export type PlanInput = {
    /** Curriculum resume target, or null when the learner has no track. */
    resume: {
        trackSlug: string
        lessonSlug: string
        lessonTitle: string
        moduleTitle: string
        modulePosition: number
    } | null
    daily: {
        slug: string
        title: string
        difficulty: string
        solvedToday: boolean
    } | null
    /** Next unsolved problem from the catalog, or null. */
    nextProblem: { slug: string; title: string; difficulty: string } | null
}

export function buildTodayPlan(input: PlanInput): PlanRow[]
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-today-plan.ts`:

```ts
// Unit tests for the signed-in home's "Today's plan".
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-today-plan.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildTodayPlan, type PlanInput } from "../lib/home/today-plan"

const RESUME: PlanInput["resume"] = {
    trackSlug: "analyst-interview-prep",
    lessonSlug: "sessionisation",
    lessonTitle: "Sessionising an event stream",
    moduleTitle: "Window functions",
    modulePosition: 3,
}
const DAILY: PlanInput["daily"] = {
    slug: "second-highest-salary",
    title: "Second highest salary",
    difficulty: "MEDIUM",
    solvedToday: false,
}
const NEXT: PlanInput["nextProblem"] = {
    slug: "duplicate-emails",
    title: "Duplicate emails",
    difficulty: "EASY",
}

function input(over: Partial<PlanInput> = {}): PlanInput {
    return { resume: null, daily: null, nextProblem: null, ...over }
}

describe("buildTodayPlan — priority", () => {
    it("puts the lesson first, then daily, then the next problem", () => {
        const rows = buildTodayPlan(
            input({ resume: RESUME, daily: DAILY, nextProblem: NEXT })
        )
        assert.deepEqual(rows.map((r) => r.kind), ["lesson", "daily", "problem"])
    })

    it("never returns more than three rows", () => {
        const rows = buildTodayPlan(
            input({ resume: RESUME, daily: DAILY, nextProblem: NEXT })
        )
        assert.ok(rows.length <= 3)
    })
})

describe("buildTodayPlan — the degraded paths", () => {
    // Production has zero modules and zero lessons, so `resume` is null for
    // every learner there. These are the cases that actually ship today.
    it("works with no curriculum at all", () => {
        const rows = buildTodayPlan(input({ daily: DAILY, nextProblem: NEXT }))
        assert.deepEqual(rows.map((r) => r.kind), ["daily", "problem"])
    })

    it("works with only a next problem", () => {
        const rows = buildTodayPlan(input({ nextProblem: NEXT }))
        assert.deepEqual(rows.map((r) => r.kind), ["problem"])
    })

    it("returns an empty plan when there is nothing to do", () => {
        assert.deepEqual(buildTodayPlan(input()), [])
    })

    it("still lists the daily when it is already solved, marked done", () => {
        // Solved-today is worth showing as a tick rather than hiding — it is
        // the learner's evidence they did the thing.
        const rows = buildTodayPlan(
            input({ daily: { ...DAILY, solvedToday: true } })
        )
        assert.equal(rows.length, 1)
        assert.equal(rows[0].done, true)
    })
})

describe("buildTodayPlan — row contents", () => {
    it("links a lesson to the reader with a 1-based module number", () => {
        // Module.position is 0-indexed; the displayed number is position + 1,
        // matching modulePrefix in components/learn/reader/lesson-nav.ts.
        const [row] = buildTodayPlan(input({ resume: RESUME }))
        assert.equal(
            row.href,
            "/learn/tracks/analyst-interview-prep/sessionisation"
        )
        assert.match(row.meta, /04/)
        assert.equal(row.title, "Sessionising an event stream")
        assert.equal(row.done, false)
    })

    it("links problems to the workspace", () => {
        const rows = buildTodayPlan(input({ daily: DAILY, nextProblem: NEXT }))
        assert.equal(rows[0].href, "/practice/second-highest-salary")
        assert.equal(rows[1].href, "/practice/duplicate-emails")
    })

    it("does not repeat the daily problem as the next problem", () => {
        // Same slug in both slots would render the same row twice.
        const rows = buildTodayPlan(
            input({
                daily: DAILY,
                nextProblem: {
                    slug: DAILY.slug,
                    title: DAILY.title,
                    difficulty: "MEDIUM",
                },
            })
        )
        assert.equal(rows.length, 1)
        assert.equal(rows[0].kind, "daily")
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test scripts/test-today-plan.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/home/today-plan.ts`. Rules:

1. Rows in fixed order: lesson, daily, problem — each included only when its input is non-null.
2. Lesson `href` is `/learn/tracks/<trackSlug>/<lessonSlug>`; meta uses `modulePrefix(modulePosition)` from `components/learn/reader/lesson-nav.ts` (1-based, zero-padded) so the number matches the reader and the module screen.
3. Daily and problem `href` are `/practice/<slug>`.
4. `done` is true only for a daily already solved today.
5. **Drop the `problem` row when its slug equals the daily's** — otherwise the same problem renders twice.
6. Never mutate the input.

- [ ] **Step 4: Wire and verify**

`package.json`: `"test:today-plan": "node --import tsx --test scripts/test-today-plan.ts",`

`.github/workflows/test.yml`, after `Test weak spots`:

```yaml
      - name: Test today's plan
        run: npm run test:today-plan
```

Run: `npm run test:today-plan`
Expected: PASS, exit 0, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/home/today-plan.ts scripts/test-today-plan.ts package.json .github/workflows/test.yml
git commit -m "feat(home): add today's-plan composition"
```

---

### Task 3: The home read

**Files:**
- Create: `lib/home/home-read.ts`

**Interfaces:**
- Consumes: `computeWeakSpots` (Task 1), `buildTodayPlan` (Task 2), `getTrackSummariesForUser` (`lib/learn/tracks-read.ts`), `getCatalogProblems` (`lib/practice/catalog-read.ts`), `computeStreaks` + `buildHeatmap` (`lib/profile-stats.ts`).
- Produces:

```ts
export type HomeData = {
    plan: PlanRow[]
    weakSpots: WeakSpot[]
    streak: StreakInfo          // { current, longest, lastActiveDate }
    /** Exactly 7 buckets, oldest first, for the week grid. */
    week: DayBucket[]           // { date: string; count: number }
    /** Track with the most progress, or null when there are no tracks. */
    activeTrack: TrackSummary | null
}

export const getHomeData: (
    userId: string,
    daily: PlanInput["daily"],   // Task 2's own type — not a third definition
    today?: Date
) => Promise<HomeData>
```

- [ ] **Step 1: Build the read**

Create `lib/home/home-read.ts`. **Not a `"use server"` module** — it takes an explicit `userId`, so it follows `lib/curriculum-read.ts`, `lib/practice/catalog-read.ts` and `lib/learn/tracks-read.ts`. Carry the same file-top comment explaining why.

Compose, do not re-derive:

- `getTrackSummariesForUser(userId)` → `activeTrack` (highest `rollup.percent` among tracks with any progress, else the first) and the `resume` for the plan.
- `getCatalogProblems(userId)` → `nextProblem` (first unsolved in curriculum order).
- One `Submission.findMany` for this user, most recent 40, selecting `status` and the problem's topic tags → `computeWeakSpots`.
- One `Submission.findMany` selecting `createdAt` over **365 days** → `buildHeatmap(dates, 365, today)`. `computeStreaks(heatmap)` → `streak`; `heatmap.slice(-7)` → `week`.

> **CORRECTED 2026-08-14 — human ruling; supersedes this plan's original text.** This step originally specified a 7-day window feeding both `week` and `streak`. That caps `streak.current` and `streak.longest` at 7, so a learner on a 15-day streak would read **7** here and **15** on `/profile`. `/profile` uses `HEATMAP_DAYS = 365` (`actions/profile.ts:51`) with the same `computeStreaks`, so the home must use the same basis. Deriving `week` as the tail of that same series means the grid and the headline **cannot** disagree by construction — there is no second source to drift. This is the same cross-screen-contradiction class as `6968fbb` and `423fc5a`, both of which needed their own fix PRs. Do not reintroduce the 7-day streak.

**Accept `today` as a parameter defaulting to `new Date()`** so a caller can pin it. `buildHeatmap` already takes one.

**`daily` is a parameter, not an internal call.** `getDailyStatusForCurrentUser()` resolves its own session, so it stays where it is and the page passes its result in. `getHomeData` then composes the entire plan — lesson, daily, problem — through `buildTodayPlan` in one place, including the rule that drops the problem row when it duplicates the daily's slug. Keep `daily` nullable: a day with no daily problem must still yield a valid plan. **Consumers render `plan` as given and never re-order or re-filter it** — that ordering rule lives in `buildTodayPlan` alone.

- [ ] **Step 2: Verify against real data**

Run against local Postgres, where a curriculum exists:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsx -e "
import {prisma} from './lib/prisma'
import {getHomeData} from './lib/home/home-read'
prisma.user.findFirst({select:{id:true,email:true}}).then(async u => {
  if (!u) { console.log('no user seeded locally'); process.exit(0) }
  const d = await getHomeData(u.id, new Date('2026-08-14T00:00:00Z'))
  console.log('plan:', d.plan.map(r=>r.kind))
  console.log('weakSpots:', d.weakSpots.length, 'week buckets:', d.week.length)
  console.log('streak:', d.streak, 'activeTrack:', d.activeTrack?.slug ?? null)
  process.exit(0)
})"
```
Expected: `week` has exactly 7 buckets; no crash when the user has no submissions.

- [ ] **Step 3: Verify the degraded shape**

The read must not assume a curriculum. Prove it against production's shape without touching production — temporarily point at a database with no modules, or assert it directly:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsx -e "
import {buildTodayPlan} from './lib/home/today-plan'
console.log('no curriculum ->', buildTodayPlan({resume:null,daily:null,nextProblem:{slug:'x',title:'X',difficulty:'EASY'}}).map(r=>r.kind))
process.exit(0)"
```
Expected: `[ 'problem' ]` — not a crash, not an empty plan.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit && npm run test:weak-spots && npm run test:today-plan`
Expected: all exit 0.

```bash
git add lib/home/home-read.ts
git commit -m "feat(home): add the narrow per-user home read"
gh pr create --base main --title "feat(home): add weak-spots and today's-plan logic"
```

> Touches `.github/workflows/test.yml` (Tasks 1–2), so this PR needs a **web-UI merge**.

---

## Phase 2 — Signed-in home

PR title: `feat(home): rebuild the signed-in dashboard`

### File Structure

- Create: `components/home/dashboard/ResumeCard.tsx`, `TodayPlan.tsx`, `ModuleProgress.tsx`, `RecentSubmissions.tsx`, `StreakCard.tsx`, `DailyCard.tsx`, `WeakSpotsCard.tsx`
- Create: `components/home/dashboard/SignedInHome.tsx` — the two-column layout
- Modify: `app/page.tsx` — fetch and branch
- Delete: `components/home/UserHome.tsx` (absorbed)

---

### Task 4: Dashboard components

**Files:**
- Create the seven components above
- Test: none directly — they are presentational; Task 6 covers them by e2e

**Interfaces:**
- Consumes: `HomeData` (Task 3), `UserStats` from `actions/submissions.ts`:

```ts
type UserStats = {
    solved: number; submissions: number; accepted: number
    byDifficulty: { EASY: number; MEDIUM: number; HARD: number }
    recent: Array<{ id: string; status: "ACCEPTED" | "WRONG_ANSWER"; createdAt: Date
        problem: { number: number; slug: string; title: string; difficulty: string
                   contestLock: { unlocksAt: Date } | null } }>
}
```
- Produces: `SignedInHome({ name, home, stats, daily })`.

- [ ] **Step 1: Build the left column**

`ResumeCard` — `primary` border, mono "Pick up where you stopped", 22px/600 title, mono meta, a 4px bar, a 42px `primary` Resume button. **Falls back**: with no curriculum resume it shows the next unsolved problem and links to `/practice/<slug>`; with neither it does not render.

`TodayPlan` — rows on `grid 18px 1fr 90px`: state icon, title + mono meta, "Open →". Renders `home.plan` **exactly as given, in the order given**. `getHomeData` already composed it through `buildTodayPlan` from the `daily` the page passed in, so the daily row is present and correctly positioned — do not insert it here, re-order the rows, or re-apply the drop-the-duplicate-problem rule. That logic has exactly one home. **Renders nothing when the plan is empty.**

`daily` is still passed to `SignedInHome` separately because `DailyCard` needs the full status (including `solvedToday`), which the plan row does not carry.

`ModuleProgress` — six cards, each number, name, 3px bar, percentage. **Does not render at all when the active track has no modules** — not six empty cards.

`RecentSubmissions` — rows on `grid 1fr 120px 90px 80px`: problem, verdict chip, relative time, runtime. Verdict chips: Accepted `primary`, Wrong answer `destructive` — each on its own tinted background and border.

- [ ] **Step 2: Build the right rail**

`StreakCard` — a 7-column grid of 26px squares in four tints keyed to `week[i].count` (0, 1, 2–3, 4+), with `streak.current` as the headline. `week` is exactly 7 buckets, oldest first.

The headline and the grid measure **different windows on purpose**: `streak.current` spans 365 days and matches `/profile` exactly, while the grid shows the last 7. A learner on a 30-day streak correctly sees "30" above seven filled squares. Label the grid as the last 7 days so the two read as complementary rather than contradictory; do not recompute a streak from `week`.

`DailyCard` — `warning` border, the daily problem, and a solved-today state.

`WeakSpotsCard` — rows of label, pass rate and a 3px bar coloured by `band`, ending in "Drill these →" linking to `/practice`. **Renders nothing when `weakSpots` is empty** — a new learner has no weak spots, and an empty card is worse than no card.

- [ ] **Step 3: Preserve the inventory**

Three behaviours live in `UserHome.tsx` and appear in no design screen. Carry each into the new components or state plainly in your report why it should go:

- the **new-user hero** shown to a learner with no submissions;
- the **progress-by-difficulty** breakdown;
- the **"recommended next"** first-unsolved card — note this overlaps `TodayPlan`'s third row, so folding it in is legitimate; deleting it silently is not.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run check:theme-utilities && npm run check:token-parity && npm run build`
Expected: all exit 0. If the guard names a class, use a mapped token — do not add a new one.

- [ ] **Step 5: Commit**

```bash
git add components/home/dashboard
git commit -m "feat(home): add the signed-in dashboard components"
```

---

### Task 5: Wire the page

**Files:**
- Modify: `app/page.tsx`
- Delete: `components/home/UserHome.tsx`

- [ ] **Step 1: Rewire**

`app/page.tsx` keeps its existing session branch. For a signed-in user:

```ts
const [stats, daily] = await Promise.all([
    getUserStats(),
    getDailyStatusForCurrentUser(),
])
const home = await getHomeData(session.user.id, daily)
```

then renders `SignedInHome`. Two phases, not one three-way `Promise.all`: `getHomeData` now consumes `daily`, so it cannot start until the daily resolves. That costs one extra round trip of latency, and it is the deliberate price of composing the plan in exactly one place — the alternative was `TodayPlan` re-deriving `buildTodayPlan`'s ordering and de-duplication rules in the component, putting the same rule in two places. Stats and daily still overlap, so only the home read is serialized behind them.

Keep the existing fallback: if the stats read fails, fall through to the anonymous page rather than erroring.

Delete `UserHome.tsx` only after confirming nothing else imports it:

```bash
grep -rn "UserHome" app components lib tests | grep -v "components/home/UserHome.tsx"
```
Expected: no hits. An earlier sub-project found `PracticeList` had an undocumented second consumer — check, don't assume.

- [ ] **Step 2: Verify the existing e2e still passes**

`tests/e2e/daily.spec.ts` visits `/` as a signed-in user and asserts the Daily problem card. It must keep passing unchanged.

Run: `npm run build`, then `lsof -ti :3100 | xargs -r kill -9`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- daily`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git rm components/home/UserHome.tsx
git commit -m "feat(home): render the rebuilt dashboard"
```

---

### Task 6: Signed-in home e2e

**Files:**
- Create: `tests/e2e/home-signed-in.spec.ts`

- [ ] **Step 1: Write the tests**

Seed your own fixture — CI has no curriculum. Follow `tests/e2e/module.spec.ts`'s prefix-and-cleanup pattern, and `workspace.spec.ts` for `seedUser`/`sessionCookie`.

Cover:
1. A signed-in learner **with no curriculum and no submissions** sees the dashboard without crashing, and neither Module progress nor Weak spots renders. *This is production's shape — write it first.*
2. A learner with submissions sees Recent submissions with a verdict chip.
3. A learner with a seeded track and module sees Module progress and a resume target.

- [ ] **Step 2: Prove the tests are not vacuous**

Break what each test claims — for test 1, make `ModuleProgress` render unconditionally and confirm the test fails. Revert. Report what you broke and what happened.

- [ ] **Step 3: Run and commit**

Run: `npm run build`, kill `:3100`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- home-signed-in daily`
Expected: all pass.

```bash
git add tests/e2e/home-signed-in.spec.ts
git commit -m "test(home): cover the dashboard including its empty state"
gh pr create --base main --title "feat(home): rebuild the signed-in dashboard"
```

> No workflow change in this phase — Playwright already runs the directory. CLI-mergeable.

---

## Phase 3 — Signed-out home

PR title: `feat(home): rebuild the signed-out home`

### File Structure

- Create: `components/home/marketing/Hero.tsx`, `PathPreview.tsx`, `HowItWorks.tsx`, `Proof.tsx`
- Modify: `app/page.tsx` — the anonymous branch

---

### Task 7: Marketing sections

**Files:**
- Create the four components above
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `getTrackSummariesForUser(null)` for the path preview, and counts for the stat strip.

- [ ] **Step 1: Hero**

Two columns `1fr 470px`. Left: a mono stat strip, h1 at 48px/600/-0.03em capped at 17ch — *"Stop collecting tutorials. Follow one ordered path."* — a 16.5px/1.6 sub at 56ch, the CTA pair, an 11.5px mono reassurance *"Free to read. No card. Progress saves when you sign in."*, then a 4-up stat row.

**The primary CTA is "Start the path"**, linking to the first published track (`/learn/tracks/<slug>`), with an outline "Browse problems" → `/practice`. The design's "Take the 12-min assessment" is **omitted** — no such feature exists. Do not add a placeholder.

**The stat strip drops any clause that would read zero.** Production has 0 lessons, so it renders `39 problems · 3 tracks`, not `39 problems · 0 lessons · 3 tracks`.

- [ ] **Step 2: Path preview**

A `panel-raised` card: header "Your path · preview" / "Prerequisite order", then rows on `grid 32px 1fr 88px 62px` — bordered mono number chip, name over a 12px `text-dim` description, an `NL · NP` count, right-aligned state.

**Fallback**: module rows when a track has modules; **published tracks with their problem counts** when it does not. The design's footer line "Assessment decides where you enter" is **omitted** with the assessment. Keep "Skip ahead anytime →".

- [ ] **Step 3: How it works and Proof**

`HowItWorks` — four equal cards, 10px gap, each with a 2px `primary` top border and square top corners: mono step number in `primary`, 15.5px/600 title, 13.5px/1.55 body.

`Proof` — two columns. Left: *"Every lesson ends where the interview does — at a prompt"* and three `check`-prefixed claims. Right: an accepted submission — header `#247 · second-highest-salary.sql` / `Accepted · 38 ms`, a syntax-highlighted CTE, and a `primary`-tinted footer. **This is static illustrative markup**, not a live query.

- [ ] **Step 4: Preserve or retire the inventory**

`app/page.tsx`'s anonymous branch currently renders featured problems and topics. Either fold them into the new sections or state plainly in your report why they go — do not drop them silently.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run check:theme-utilities && npm run check:token-parity && npm run build`
Expected: all exit 0.

Then look at it signed out against `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev`, and report what the path preview rendered.

- [ ] **Step 6: Commit**

```bash
git add components/home/marketing app/page.tsx
git commit -m "feat(home): rebuild the signed-out home"
```

---

### Task 8: Signed-out e2e

**Files:**
- Create: `tests/e2e/home-signed-out.spec.ts`

- [ ] **Step 1: Write the tests**

1. The hero renders, and the **primary CTA links to a real track** — not `#`, not a dead route. Follow the link and assert it does not render not-found.
2. **With no modules seeded, the path preview lists tracks rather than rendering empty.** This is production's shape.
3. The stat strip contains no clause reading `0`.

- [ ] **Step 2: Run and commit**

Run: `npm run build`, kill `:3100`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- home-signed-out`
Expected: all pass.

```bash
git add tests/e2e/home-signed-out.spec.ts
git commit -m "test(home): cover the signed-out home and its fallbacks"
gh pr create --base main --title "feat(home): rebuild the signed-out home"
```

---

## Phase 4 — Mobile workspace

PR title: `feat(workspace): add the mobile segmented layout`

The only phase touching already-shipped working code, so it goes last.

### File Structure

- Create: `components/practice/workspace/MobileSegments.tsx`, `SqlAccessoryRow.tsx`
- Modify: `WorkspaceLayout.tsx`, `ProblemClient.tsx`, `components/sql/SqlEditor.tsx`, `components/layout/console/ConsoleChrome.tsx`
- Modify: `tests/e2e/workspace-shell.spec.ts`

---

### Task 9: The shell clamp

**Files:**
- Modify: `components/layout/console/ConsoleChrome.tsx`
- Modify: `tests/e2e/workspace-shell.spec.ts`

**Interfaces:**
- Consumes: `isAppRoute` from `components/layout/console/focus-route.ts`.
- Produces: app routes clamp `#app-scroll` at **every** width, keeping `pb-14`.

- [ ] **Step 1: Update the existing test first**

`tests/e2e/workspace-shell.spec.ts` currently asserts `overflow-y: auto` below `lg` on an app route. That assertion encodes the old behaviour. Change it to assert `hidden` at both 768px and 1440px, and that `pb-14` is still present below `lg` so the fixed `MobileTabBar` is cleared.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run build`, kill `:3100`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- workspace-shell`
Expected: FAIL at 768px — `auto` where `hidden` is now expected.

- [ ] **Step 3: Make the change**

In `ConsoleChrome.tsx`, the app-route branch becomes `overflow-hidden` at all widths while keeping `pb-14 lg:pb-0`. Focus routes and normal routes are unchanged.

- [ ] **Step 4: Verify**

Run the same e2e: PASS at both widths. Then `npm run test:e2e -- lesson-reader` — the reader is the other shell-mode consumer and must be unaffected.

- [ ] **Step 5: Commit**

```bash
git add components/layout/console/ConsoleChrome.tsx tests/e2e/workspace-shell.spec.ts
git commit -m "feat(console): clamp app routes at every width"
```

---

### Task 10: Segments, accessory row and the problems sheet

**Files:**
- Create: `components/practice/workspace/MobileSegments.tsx`, `SqlAccessoryRow.tsx`
- Modify: `WorkspaceLayout.tsx`, `ProblemClient.tsx`, `components/sql/SqlEditor.tsx`

**Interfaces:**
- Produces:

```tsx
export type Segment = "problem" | "code" | "result"

export function MobileSegments(props: {
    active: Segment
    onChange: (s: Segment) => void
    /** Tints the Result segment `primary` when a verdict is unseen. */
    unseenVerdict: boolean
}): JSX.Element

export function SqlAccessoryRow(props: {
    onInsert: (text: string) => void
}): JSX.Element
```

- [ ] **Step 1: All three panes stay mounted**

In `WorkspaceLayout`, below `lg` wrap each pane in a container whose class toggles on `active`:

```tsx
<div className={active === "problem" ? "" : "hidden"}>{problemPanel}</div>
<div className={active === "code" ? "" : "hidden"}>{editor}</div>
<div className={active === "result" ? "" : "hidden"}>{results}</div>
```

**Do not conditionally mount.** Monaco must mount once — unmounting it discards undo history and re-runs its initialisation every time the learner checks the problem statement. Above `lg` the existing column layout is unchanged.

This requires the results pane to be addressable separately from the editor. `EditorPane` currently renders `SqlEditor`, `ActionBar` and `ResultsPane` together; below `lg` the editor and results belong to different segments. Restructure so `WorkspaceLayout` can place them independently, without changing the desktop composition.

- [ ] **Step 2: The verdict signal**

`ProblemClient` owns `activeSegment` and `unseenVerdict`. Its `handleSubmit` already receives the outcome, so set `unseenVerdict` there and clear it when the learner opens Result. **The segment must not auto-switch** — the design signals rather than switching, so submitting does not yank the learner off the editor.

- [ ] **Step 3: The accessory row**

Chips: `SELECT FROM WHERE OVER PARTITION BY ORDER BY ( ) , *` — 36px, mono, horizontally scrollable. Sticky at the bottom of the Code segment, above the action bar.

To insert at the cursor, add an `onEditorReady` callback to `SqlEditor` — it already captures the instance in `handleMount` — and call `executeEdits` at the current selection.

- [ ] **Step 4: The problems sheet**

The mobile header gains a list icon opening `ProblemsPanel` as a full-screen sheet. **Reuse `ProblemsPanel`** — do not write a mobile copy. Without this there is no way to reach another problem on a phone, since the panel is `lg:flex` only.

- [ ] **Step 5: Run and Submit**

Equal-width 46px buttons below `lg`. Above `lg` the action bar is unchanged. `⌘↵` and `⌘⇧↵` keep working.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run check:theme-utilities && npm run build`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- sql-engine workspace`
Expected: all pass — `sql-engine` is the regression guard for the testids, the truncation warning and timeout recovery.

- [ ] **Step 7: Commit**

```bash
git add components/practice/workspace components/practice/ProblemClient.tsx components/sql/SqlEditor.tsx
git commit -m "feat(workspace): add the mobile segmented layout"
```

---

### Task 11: Mobile e2e and the inventory walk

**Files:**
- Create: `tests/e2e/workspace-mobile.spec.ts`

- [ ] **Step 1: The test that matters most**

At 375px: type into the editor, switch to Problem, switch back to Code, and **assert the text is still there**. This is what catches a later "simplification" of the CSS toggle into conditional mounting.

Also cover: the Result segment tints after a submit without auto-switching; the accessory row inserts at the cursor; the problems sheet opens and closes.

- [ ] **Step 2: Prove it is not vacuous**

Change the segment rendering to conditional mounting, confirm the editor-state test fails, and revert. Report what happened.

- [ ] **Step 3: Walk the capability inventory**

Exercise **every** row of the table at the top of this plan against a dev server. The `⌘↵`/`⌘⇧↵` shortcuts, the truncation warning, timeout recovery and `MobileTabBar` are the ones nothing automated fully covers.

- [ ] **Step 4: Full verification**

```bash
npm run test:console-nav && npm run test:catalog-model && npm run test:module-model \
  && npm run test:tracks-model && npm run test:problems-panel && npm run test:pass-rate \
  && npm run test:approach-sort && npm run test:weak-spots && npm run test:today-plan \
  && npm run test:lesson-nav && npm run test:reading-progress && npm run test:scroll-restoration \
  && npm run check:token-parity && npm run check:theme-utilities \
  && npx tsc --noEmit && npm run build
lsof -ti :3100 | xargs -r kill -9
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e
```
Expected: exit 0 throughout. Report actual counts. `learn-csp` fails locally and passes in CI — that one is environmental.

- [ ] **Step 5: Open the phase 4 PR**

```bash
gh pr create --base main --title "feat(workspace): add the mobile segmented layout"
```

The body must list which inventory rows were verified by hand.

---

## Done means

- Four PRs merged to `main`, each with `--base main`.
- Two new suites in `.github/workflows/test.yml`: `test:weak-spots`, `test:today-plan`.
- Every capability-inventory row verified by hand at the end of phase 4.
- `docs/ROADMAP.md` gains an SP6 entry.
- The spec's two open questions — the "Today's plan" definition and mobile being workspace-only — either confirmed or carried into the SP6 handoff.
