# V11 Internal Analytics Portal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/analytics`, an ADMIN-only operator portal reporting platform health and content performance from data the database already holds.

**Architecture:** All decision logic lives in pure, Prisma-free modules under `lib/analytics/` so it unit-tests with no database; `lib/analytics/analytics-read.ts` is a thin Prisma query layer with no branching; the page is a server component inside the existing admin console shell. Metrics derived from immutable timestamped rows are always computed live; only mutable state with no history is snapshotted daily by a cron.

**Tech Stack:** Next.js 16 App Router, Prisma 7 + PostgreSQL, TypeScript strict, `node --import tsx --test` for units, Playwright for e2e, Tailwind v4 semantic tokens, Lucide icons.

**Spec:** [`docs/superpowers/specs/2026-08-18-v11-analytics-portal-design.md`](../specs/2026-08-18-v11-analytics-portal-design.md)

**Baseline:** `main` @ `aa54a3a` (v0.11.0)

## Global Constraints

Every task's requirements implicitly include this section.

- **Day bucketing:** reuse `toDayKey` and `buildHeatmap` from `lib/profile-stats.ts`. Writing a new day-bucketing implementation is a defect — agreement with the `/profile` heatmap must be structural, not coincidental.
- **Deltas:** reuse `computeDelta` from `lib/admin/metric-delta.ts`. It returns `null` where a delta would be dishonest; render no delta line in that case — not a zero, not a dash.
- **`MetricSnapshot` holds only non-recomputable state.** Adding a metric that can be recomputed from immutable rows is a defect, not an optimisation.
- **`MetricCard` (`components/admin/MetricCard.tsx`) renders as a `<Link>` and its `AdminMetric` type requires `href: string`.** Its `DELTA_COLOR` hardcodes `up → text-easy` (green), `down → text-destructive` (red). Never use it for a metric where rising is bad (failure counts, drift counts) without an explicit polarity prop. Rendering "failures up 40%" in green is a correctness defect.
- **No analytics query may select `Submission.code`** (`@db.Text`, potentially large). Every read uses an explicit `select`.
- **Maximum window is 365 days.** Out-of-range windows are rejected with a thrown `RangeError`, never silently clamped.
- **`lib/analytics/*` is Prisma-free except `analytics-read.ts`.** No `lib/` file may import from `actions/`. `analytics-read.ts` must NOT carry a `"use server"` directive.
- **ADMIN-only.** Use `requireAdminPage()` from `lib/admin-page-auth.ts` (which redirects any non-ADMIN, including MODERATOR). Do not use `requireAdminOrModeratorPage`.
- **Honesty constraints are requirements:** deltas only where real; retention with no complete cohort renders "not enough history yet", never 0%; rates over tiny denominators show the denominator; zero states are stated, not blank; the `OTHER` failure category is always shown, never dropped.
- **Every new test suite is wired into `.github/workflows/test.yml` in the same PR.** `npm run check:ci-coverage` fails on an unwired script.
- **Semantic color tokens only** (`bg-surface`, `text-muted-foreground`, `border-border`, …). No hex, no `slate-*`/`blue-*`. `npm run check:token-parity` must pass.
- **No emoji.** Lucide icons only.
- **Admin stays a normal console shell route.** No new shell mode; the `isFocusRoute`/`isAppRoute` mutual-exclusivity test must stay green.
- **Build with `npm run build`** (pinned to `--webpack`). Never drop `--webpack`.
- **Every PR targets `main`:** `gh pr create --base main`. Omitting the flag targets `production` and deploys unfinished work live.
- After editing `prisma/schema.prisma`, restart the dev server — the running process holds the old generated client.

---

## File Structure

**Phase 1 — foundation**

| File | Responsibility |
| --- | --- |
| `prisma/schema.prisma` | Five additive indexes + the `MetricSnapshot` model |
| `lib/analytics/metric-windows.ts` | Window validation, UTC day ranges, previous-period bounds, daily series |
| `lib/analytics/retention.ts` | Cohort retention with insufficient-history detection |
| `lib/analytics/funnel.ts` | Funnel step counts and conversion rates |
| `lib/analytics/failure-taxonomy.ts` | Free-text `Submission.reason` → `FailureCategory` |
| `lib/analytics/counter-drift.ts` | Denormalized counters vs true counts |
| `lib/analytics/analytics-read.ts` | Prisma aggregate reads. No branching logic. |
| `app/api/cron/analytics-snapshot/route.ts` | `CRON_SECRET`-gated daily snapshot writer |
| `vercel.json` | Third cron entry |

**Phase 2 — platform section**

| File | Responsibility |
| --- | --- |
| `app/admin/analytics/page.tsx` | ADMIN-gated server component |
| `components/admin/analytics/PlatformSection.tsx` | Sign-ups, two activity series, submissions, acceptance |
| `components/admin/analytics/RetentionTable.tsx` | Cohort table with insufficient-history copy |
| `components/admin/analytics/FunnelBar.tsx` | Three-step funnel |
| `components/admin/analytics/StatTile.tsx` | Non-linking metric tile with explicit polarity |
| `lib/admin/admin-nav-model.ts` | One new nav item |

**Phase 3 — content performance**

| File | Responsibility |
| --- | --- |
| `components/admin/analytics/ContentSection.tsx` | Per-problem table + per-track completion |
| `components/admin/analytics/DriftIndicator.tsx` | Counter-drift signal |

**Phase 4 — drill-down**

| File | Responsibility |
| --- | --- |
| `app/admin/analytics/problems/[slug]/page.tsx` | Single-problem drill-down |
| `components/admin/analytics/FailureBreakdown.tsx` | Failure-category bars |

---

## Phase 1 — Foundation (PR 1)

No UI. Verified by unit suites plus an idempotent cron invocation.

### Task 1: Schema — indexes and `MetricSnapshot`

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_analytics_foundation/migration.sql` (generated)

**Interfaces:**
- Produces: `MetricSnapshot` model with fields `day` (String, `@id`), `registeredUsers`, `publishedProblems`, `publishedArticles`, `publishedTracks`, `lessonsInProgress` (all `Int`), `createdAt` (DateTime).

- [ ] **Step 1: Add the five indexes**

In `prisma/schema.prisma`, add to `model Submission` alongside its existing `@@index` lines:

```prisma
  @@index([createdAt])
  @@index([problemId, status])
```

Add to `model User`:

```prisma
  @@index([createdAt])
```

Add to `model LessonProgress` (it already has `@@index([userId, completedAt])`, which is `userId`-leading and cannot serve a global range):

```prisma
  @@index([completedAt])
  @@index([updatedAt])
```

Both are needed and they serve different queries: `completedAt` backs the lessons-completed series and the snapshot's in-progress count, `updatedAt` backs the trailing-window learn-activity count. See Task 7 for why `updatedAt` supports only a window aggregate and not a per-day series.

- [ ] **Step 2: Add the `MetricSnapshot` model**

Append to `prisma/schema.prisma`:

```prisma
/// Daily point-in-time counts for state that CANNOT be recomputed from
/// immutable rows. Everything derivable from a createdAt/completedAt
/// timestamp is computed live instead — a stored copy would be a second
/// source of truth that can only drift.
///
/// `day` is a YYYY-MM-DD UTC key from lib/profile-stats.ts `toDayKey`,
/// and is the primary key so the first daily write is idempotent:
/// retries preserve that original point-in-time value.
model MetricSnapshot {
  day               String   @id
  registeredUsers   Int
  publishedProblems Int
  publishedArticles Int
  publishedTracks   Int
  lessonsInProgress Int
  createdAt         DateTime @default(now())
}
```

- [ ] **Step 3: Generate and apply the migration**

Run:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx prisma migrate dev --name analytics_foundation
```

Expected: migration created and applied; `prisma generate` runs. The migration must contain only `CREATE INDEX` and `CREATE TABLE` statements — no `ALTER`, no `DROP`, no data change. Read the generated SQL and confirm this before committing.

- [ ] **Step 4: Verify the client regenerated**

Run:

```bash
npx tsc --noEmit
```

Expected: exit 0. `prisma.metricSnapshot` is now typed.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(analytics): add aggregate indexes and MetricSnapshot"
```

---

### Task 2: `metric-windows.ts` — UTC windows and series

**Files:**
- Create: `lib/analytics/metric-windows.ts`
- Test: `scripts/test-analytics-windows.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Consumes: `toDayKey(d: Date): string` and `buildHeatmap(dates: Date[], windowDays: number, today: Date): DayBucket[]` from `lib/profile-stats.ts`; `DayBucket = { date: string; count: number }`.
- Produces:
  - `MAX_WINDOW_DAYS: 365`
  - `assertWindow(windowDays: number): void` — throws `RangeError`
  - `windowBounds(windowDays: number, endDay: Date): { start: Date; end: Date }`
  - `previousWindowBounds(windowDays: number, endDay: Date): { start: Date; end: Date }`
  - `dailySeries(dates: Date[], windowDays: number, endDay: Date): DayBucket[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-windows.ts`:

```ts
// Unit tests for analytics window maths.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-windows.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    MAX_WINDOW_DAYS,
    assertWindow,
    windowBounds,
    previousWindowBounds,
    dailySeries,
} from "../lib/analytics/metric-windows"
import { toDayKey } from "../lib/profile-stats"

const END = new Date("2026-03-15T09:30:00.000Z")

describe("assertWindow", () => {
    it("accepts the maximum window", () => {
        assert.doesNotThrow(() => assertWindow(MAX_WINDOW_DAYS))
    })

    it("rejects a window past the maximum rather than clamping it", () => {
        assert.throws(() => assertWindow(MAX_WINDOW_DAYS + 1), RangeError)
    })

    it("rejects a zero or negative window", () => {
        assert.throws(() => assertWindow(0), RangeError)
        assert.throws(() => assertWindow(-7), RangeError)
    })
})

describe("windowBounds", () => {
    it("anchors to UTC midnight so the first and last day are whole", () => {
        const { start, end } = windowBounds(7, END)
        assert.equal(start.toISOString(), "2026-03-09T00:00:00.000Z")
        // end is exclusive: midnight after the end day
        assert.equal(end.toISOString(), "2026-03-16T00:00:00.000Z")
    })

    it("covers exactly windowDays days", () => {
        const { start, end } = windowBounds(30, END)
        const days = (end.getTime() - start.getTime()) / 86_400_000
        assert.equal(days, 30)
    })
})

describe("previousWindowBounds", () => {
    it("returns the equal-length window immediately before, without overlap", () => {
        const cur = windowBounds(7, END)
        const prev = previousWindowBounds(7, END)
        assert.equal(prev.end.toISOString(), cur.start.toISOString())
        const days = (prev.end.getTime() - prev.start.getTime()) / 86_400_000
        assert.equal(days, 7)
    })
})

describe("dailySeries", () => {
    it("returns exactly windowDays buckets, oldest first", () => {
        const series = dailySeries([], 7, END)
        assert.equal(series.length, 7)
        assert.equal(series[0].date, "2026-03-09")
        assert.equal(series[6].date, "2026-03-15")
    })

    it("buckets a timestamp just before UTC midnight into that same day", () => {
        const late = new Date("2026-03-14T23:59:59.000Z")
        const series = dailySeries([late], 7, END)
        const bucket = series.find((b) => b.date === "2026-03-14")
        assert.equal(bucket?.count, 1)
    })

    it("agrees with toDayKey — the /profile heatmap convention", () => {
        const d = new Date("2026-03-11T17:00:00.000Z")
        const series = dailySeries([d], 7, END)
        const bucket = series.find((b) => b.date === toDayKey(d))
        assert.equal(bucket?.count, 1)
    })

    it("rejects an oversized window", () => {
        assert.throws(() => dailySeries([], MAX_WINDOW_DAYS + 1, END), RangeError)
    })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test scripts/test-analytics-windows.ts`
Expected: FAIL — cannot resolve `../lib/analytics/metric-windows`.

- [ ] **Step 3: Implement**

Create `lib/analytics/metric-windows.ts`:

```ts
/**
 * Window maths for the analytics portal.
 *
 * Day bucketing is NOT reimplemented here. `toDayKey` and `buildHeatmap`
 * from lib/profile-stats.ts are the project's single day-bucketing
 * convention (YYYY-MM-DD in UTC), already used by the /profile heatmap
 * and the home streak. Reusing them makes cross-screen agreement
 * structural rather than coincidental.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

import { buildHeatmap, type DayBucket } from "../profile-stats"

/** Matches the /profile heatmap window. */
export const MAX_WINDOW_DAYS = 365

const MS_PER_DAY = 86_400_000

/** Throws rather than clamping: a silently truncated range would report a
 *  different period than the caller asked for. */
export function assertWindow(windowDays: number): void {
    if (!Number.isInteger(windowDays) || windowDays < 1) {
        throw new RangeError(`Window must be a positive integer, got ${windowDays}`)
    }
    if (windowDays > MAX_WINDOW_DAYS) {
        throw new RangeError(
            `Window may not exceed ${MAX_WINDOW_DAYS} days, got ${windowDays}`
        )
    }
}

function utcMidnight(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Half-open bounds [start, end) covering `windowDays` whole UTC days and
 * ending with the day containing `endDay`. Anchoring to UTC midnight is
 * what keeps a Prisma range query consistent with the day buckets — a
 * bound of "now" would make the newest day partial.
 */
export function windowBounds(
    windowDays: number,
    endDay: Date
): { start: Date; end: Date } {
    assertWindow(windowDays)
    const endMidnight = utcMidnight(endDay)
    const end = new Date(endMidnight.getTime() + MS_PER_DAY)
    const start = new Date(end.getTime() - windowDays * MS_PER_DAY)
    return { start, end }
}

/** The equal-length window immediately before, sharing a boundary so the
 *  two never overlap and never leave a gap. */
export function previousWindowBounds(
    windowDays: number,
    endDay: Date
): { start: Date; end: Date } {
    const current = windowBounds(windowDays, endDay)
    return {
        start: new Date(current.start.getTime() - windowDays * MS_PER_DAY),
        end: current.start,
    }
}

/** Zero-filled daily counts, oldest first, exactly `windowDays` long. */
export function dailySeries(
    dates: Date[],
    windowDays: number,
    endDay: Date
): DayBucket[] {
    assertWindow(windowDays)
    return buildHeatmap(dates, windowDays, endDay)
}

export type { DayBucket }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test scripts/test-analytics-windows.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Wire into `package.json` and CI**

Add to `package.json` scripts, keeping alphabetical position among the `test:` entries:

```json
"test:analytics-windows": "node --import tsx --test scripts/test-analytics-windows.ts",
```

Add to `.github/workflows/test.yml`, following the existing block shape:

```yaml
      - name: Test analytics window maths
        run: npm run test:analytics-windows
```

- [ ] **Step 6: Verify CI coverage guard passes**

Run: `npm run check:ci-coverage`
Expected: exit 0. It fails if the new script is unwired.

- [ ] **Step 7: Commit**

```bash
git add lib/analytics/metric-windows.ts scripts/test-analytics-windows.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): UTC window maths reusing the heatmap convention"
```

---

### Task 3: `retention.ts` — cohorts with insufficient-history detection

**Files:**
- Create: `lib/analytics/retention.ts`
- Test: `scripts/test-analytics-retention.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Consumes: `toDayKey` from `lib/profile-stats.ts`.
- Produces:
  - `RETENTION_BUCKETS: readonly [1, 7, 30]`
  - `type CohortRetention = { cohortDay: string; cohortSize: number; retained: number | null; rate: number | null }`
  - `cohortRetention(cohorts: Map<string, string[]>, activityByUser: Map<string, Set<string>>, bucketDays: number, today: Date): CohortRetention[]`

`retained`/`rate` are `null` **only** when the cohort is too young for the bucket to have elapsed. A cohort old enough where nobody returned is `retained: 0, rate: 0`. These two states must never be conflated — that distinction is the point of this module.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-retention.ts`:

```ts
// Unit tests for cohort retention.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-retention.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { cohortRetention } from "../lib/analytics/retention"

const TODAY = new Date("2026-03-15T00:00:00.000Z")

describe("cohortRetention", () => {
    it("counts a user active on the bucket day as retained", () => {
        const cohorts = new Map([["2026-03-08", ["u1", "u2"]]])
        const activity = new Map([["u1", new Set(["2026-03-15"])]])
        const [row] = cohortRetention(cohorts, activity, 7, TODAY)
        assert.equal(row.cohortSize, 2)
        assert.equal(row.retained, 1)
        assert.equal(row.rate, 0.5)
    })

    it("counts activity on or after the bucket day, not only exactly on it", () => {
        const cohorts = new Map([["2026-03-01", ["u1"]]])
        const activity = new Map([["u1", new Set(["2026-03-12"])]])
        const [row] = cohortRetention(cohorts, activity, 7, TODAY)
        assert.equal(row.retained, 1)
    })

    // THE CENTRAL DISTINCTION. A young cohort is unknowable; an old cohort
    // with no returns is a real zero. Reporting either as the other is the
    // defect this module exists to prevent.
    it("reports a cohort too young for the bucket as unknown, not as zero", () => {
        const cohorts = new Map([["2026-03-14", ["u1"]]])
        const activity = new Map<string, Set<string>>()
        const [row] = cohortRetention(cohorts, activity, 7, TODAY)
        assert.equal(row.retained, null)
        assert.equal(row.rate, null)
    })

    it("reports an elapsed cohort with no returns as a genuine zero", () => {
        const cohorts = new Map([["2026-03-01", ["u1"]]])
        const activity = new Map<string, Set<string>>()
        const [row] = cohortRetention(cohorts, activity, 7, TODAY)
        assert.equal(row.retained, 0)
        assert.equal(row.rate, 0)
    })

    it("treats the exact boundary day as elapsed", () => {
        // signed up 2026-03-08, D7 lands on 2026-03-15 which is today
        const cohorts = new Map([["2026-03-08", ["u1"]]])
        const activity = new Map<string, Set<string>>()
        const [row] = cohortRetention(cohorts, activity, 7, TODAY)
        assert.equal(row.retained, 0, "boundary cohort is knowable, not null")
    })

    it("never counts activity before the bucket day", () => {
        const cohorts = new Map([["2026-03-01", ["u1"]]])
        const activity = new Map([["u1", new Set(["2026-03-03"])]])
        const [row] = cohortRetention(cohorts, activity, 7, TODAY)
        assert.equal(row.retained, 0, "day-3 activity must not satisfy D7")
    })

    it("returns an empty cohort as size zero with a null rate, not NaN", () => {
        const cohorts = new Map([["2026-03-01", [] as string[]]])
        const [row] = cohortRetention(cohorts, new Map(), 7, TODAY)
        assert.equal(row.cohortSize, 0)
        assert.equal(row.rate, null)
    })

    it("orders cohorts oldest first", () => {
        const cohorts = new Map([
            ["2026-03-05", ["u2"]],
            ["2026-03-01", ["u1"]],
        ])
        const rows = cohortRetention(cohorts, new Map(), 7, TODAY)
        assert.deepEqual(
            rows.map((r) => r.cohortDay),
            ["2026-03-01", "2026-03-05"]
        )
    })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test scripts/test-analytics-retention.ts`
Expected: FAIL — cannot resolve `../lib/analytics/retention`.

- [ ] **Step 3: Implement**

Create `lib/analytics/retention.ts`:

```ts
/**
 * Cohort retention.
 *
 * The load-bearing distinction here is between "we cannot know yet" and
 * "we know, and it was zero". A platform ten days old has no D30 cohort;
 * rendering that as 0% would read as total churn. `retained` and `rate`
 * are null in the first case and 0 in the second, and callers must render
 * them differently.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

import { toDayKey } from "../profile-stats"

export const RETENTION_BUCKETS = [1, 7, 30] as const

export type CohortRetention = {
    cohortDay: string
    cohortSize: number
    /** null when the bucket day has not yet elapsed for this cohort. */
    retained: number | null
    /** null when unknowable, or when the cohort is empty (no 0/0). */
    rate: number | null
}

const MS_PER_DAY = 86_400_000

/**
 * @param cohorts        cohort day key -> user ids that signed up that day
 * @param activityByUser user id -> set of day keys the user was active on
 * @param bucketDays     1, 7 or 30
 * @param today          upper bound for what is knowable
 */
export function cohortRetention(
    cohorts: Map<string, string[]>,
    activityByUser: Map<string, Set<string>>,
    bucketDays: number,
    today: Date
): CohortRetention[] {
    const todayKey = toDayKey(today)

    const rows: CohortRetention[] = []
    for (const [cohortDay, userIds] of cohorts) {
        const bucketDayKey = addDays(cohortDay, bucketDays)

        // Not yet elapsed: the answer is unknown, not zero.
        if (bucketDayKey > todayKey) {
            rows.push({
                cohortDay,
                cohortSize: userIds.length,
                retained: null,
                rate: null,
            })
            continue
        }

        let retained = 0
        for (const userId of userIds) {
            const days = activityByUser.get(userId)
            if (!days) continue
            // Retained if active on or after the bucket day — "still here
            // at day N", not "here on exactly day N".
            for (const day of days) {
                if (day >= bucketDayKey) {
                    retained++
                    break
                }
            }
        }

        rows.push({
            cohortDay,
            cohortSize: userIds.length,
            retained,
            // An empty cohort has no rate. Do not emit 0/0 as 0.
            rate: userIds.length === 0 ? null : retained / userIds.length,
        })
    }

    // Day keys are YYYY-MM-DD, so lexicographic order is chronological.
    return rows.sort((a, b) => (a.cohortDay < b.cohortDay ? -1 : 1))
}

function addDays(dayKey: string, days: number): string {
    const base = new Date(`${dayKey}T00:00:00.000Z`)
    return toDayKey(new Date(base.getTime() + days * MS_PER_DAY))
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test scripts/test-analytics-retention.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Wire into `package.json` and CI**

```json
"test:analytics-retention": "node --import tsx --test scripts/test-analytics-retention.ts",
```

```yaml
      - name: Test analytics retention cohorts
        run: npm run test:analytics-retention
```

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/retention.ts scripts/test-analytics-retention.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): cohort retention distinguishing unknown from zero"
```

---

### Task 4: `funnel.ts` — step conversion

**Files:**
- Create: `lib/analytics/funnel.ts`
- Test: `scripts/test-analytics-funnel.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Produces:
  - `type FunnelInput = { key: string; label: string; count: number }`
  - `type FunnelStep = FunnelInput & { rateFromPrevious: number | null; rateFromStart: number | null }`
  - `buildFunnel(steps: FunnelInput[]): FunnelStep[]`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-funnel.ts`:

```ts
// Unit tests for funnel conversion maths.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-funnel.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { buildFunnel } from "../lib/analytics/funnel"

describe("buildFunnel", () => {
    it("computes conversion from the previous step and from the start", () => {
        const out = buildFunnel([
            { key: "signup", label: "Signed up", count: 100 },
            { key: "submitted", label: "First submission", count: 40 },
            { key: "accepted", label: "First acceptance", count: 10 },
        ])
        assert.equal(out[1].rateFromPrevious, 0.4)
        assert.equal(out[2].rateFromPrevious, 0.25)
        assert.equal(out[2].rateFromStart, 0.1)
    })

    it("gives the first step no incoming rate rather than 100%", () => {
        const out = buildFunnel([{ key: "signup", label: "Signed up", count: 100 }])
        assert.equal(out[0].rateFromPrevious, null)
        assert.equal(out[0].rateFromStart, null)
    })

    it("returns null rather than NaN when the previous step is zero", () => {
        const out = buildFunnel([
            { key: "signup", label: "Signed up", count: 0 },
            { key: "submitted", label: "First submission", count: 0 },
        ])
        assert.equal(out[1].rateFromPrevious, null)
        assert.equal(out[1].rateFromStart, null)
    })

    it("preserves keys, labels and counts unchanged", () => {
        const out = buildFunnel([
            { key: "signup", label: "Signed up", count: 7 },
            { key: "submitted", label: "First submission", count: 3 },
        ])
        assert.equal(out[1].key, "submitted")
        assert.equal(out[1].label, "First submission")
        assert.equal(out[1].count, 3)
    })

    it("returns an empty array for no steps", () => {
        assert.deepEqual(buildFunnel([]), [])
    })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test scripts/test-analytics-funnel.ts`
Expected: FAIL — cannot resolve `../lib/analytics/funnel`.

- [ ] **Step 3: Implement**

Create `lib/analytics/funnel.ts`:

```ts
/**
 * Funnel step conversion.
 *
 * Rates are null wherever a denominator is zero. Emitting 0 there would
 * claim a measured 0% conversion from a population that does not exist.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

export type FunnelInput = {
    key: string
    label: string
    count: number
}

export type FunnelStep = FunnelInput & {
    /** null for the first step, and wherever the previous count is 0. */
    rateFromPrevious: number | null
    /** null for the first step, and wherever the first count is 0. */
    rateFromStart: number | null
}

export function buildFunnel(steps: FunnelInput[]): FunnelStep[] {
    if (steps.length === 0) return []
    const first = steps[0].count

    return steps.map((step, i) => {
        if (i === 0) {
            return { ...step, rateFromPrevious: null, rateFromStart: null }
        }
        const prev = steps[i - 1].count
        return {
            ...step,
            rateFromPrevious: prev === 0 ? null : step.count / prev,
            rateFromStart: first === 0 ? null : step.count / first,
        }
    })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test scripts/test-analytics-funnel.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Wire into `package.json` and CI**

```json
"test:analytics-funnel": "node --import tsx --test scripts/test-analytics-funnel.ts",
```

```yaml
      - name: Test analytics funnel maths
        run: npm run test:analytics-funnel
```

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/funnel.ts scripts/test-analytics-funnel.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): funnel conversion with null rates over empty steps"
```

---

### Task 5: `failure-taxonomy.ts` — classify free-text reasons

**Files:**
- Create: `lib/analytics/failure-taxonomy.ts`
- Test: `scripts/test-analytics-failure-taxonomy.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Produces:
  - `type FailureCategory = "ROW_COUNT" | "COLUMN_MISMATCH" | "ROW_CONTENT" | "MALFORMED_RESULT" | "PROBLEM_DEFECT" | "OTHER"`
  - `FAILURE_CATEGORIES: readonly FailureCategory[]`
  - `FAILURE_LABELS: Record<FailureCategory, string>`
  - `classifyFailure(reason: string | null): FailureCategory`
  - `tallyFailures(reasons: (string | null)[]): Record<FailureCategory, number>`

**Why read-time classification, not a new column:** it works retroactively across every submission already in the database. A `reasonCode` column could only describe rows written after the migration.

**Test contract (mandatory):** the test drives genuinely mismatched data through the real `compareResults` from `lib/sql-validator.ts` and classifies whatever message it produces. Asserting against hand-copied message strings does not satisfy this and is a review defect — the point is that editing a validator message breaks this test instead of silently degrading classification into `OTHER`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-failure-taxonomy.ts`:

```ts
// Unit tests for submission failure classification.
//
// These drive REAL mismatched data through the actual validator rather
// than asserting on hand-copied strings. If someone edits a message in
// lib/sql-validator.ts, this suite fails — which is the point. Copying
// the message text here instead would let classification silently decay
// into OTHER while the tests stayed green.
//
// Run: node --import tsx --test scripts/test-analytics-failure-taxonomy.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { compareResults } from "../lib/sql-validator"
import {
    classifyFailure,
    tallyFailures,
    FAILURE_CATEGORIES,
} from "../lib/analytics/failure-taxonomy"

/** Run the real validator and hand back the reason it produced. */
function reasonFor(
    user: unknown,
    expected: unknown,
    ordered = true
): string {
    const result = compareResults(user, expected, { ordered })
    assert.equal(result.ok, false, "fixture must actually fail validation")
    return (result as { ok: false; reason: string }).reason
}

describe("classifyFailure — driven through the real validator", () => {
    it("classifies a row-count mismatch", () => {
        const reason = reasonFor([{ a: 1 }], [{ a: 1 }, { a: 2 }])
        assert.equal(classifyFailure(reason), "ROW_COUNT")
    })

    it("classifies a column mismatch", () => {
        const reason = reasonFor([{ a: 1 }], [{ b: 1 }])
        assert.equal(classifyFailure(reason), "COLUMN_MISMATCH")
    })

    it("classifies wrong values in the ordered path", () => {
        const reason = reasonFor([{ a: 1 }], [{ a: 2 }], true)
        assert.equal(classifyFailure(reason), "ROW_CONTENT")
    })

    it("classifies wrong values in the order-insensitive path", () => {
        const reason = reasonFor([{ a: 1 }, { a: 3 }], [{ a: 1 }, { a: 2 }], false)
        assert.equal(classifyFailure(reason), "ROW_CONTENT")
    })

    it("classifies a non-array user result", () => {
        const reason = reasonFor("not rows", [{ a: 1 }])
        assert.equal(classifyFailure(reason), "MALFORMED_RESULT")
    })

    it("classifies malformed expected output as a problem defect", () => {
        const reason = reasonFor([{ a: 1 }], "not rows")
        assert.equal(classifyFailure(reason), "PROBLEM_DEFECT")
    })
})

describe("classifyFailure — unrecognised input", () => {
    it("returns OTHER for an unfamiliar message rather than guessing", () => {
        assert.equal(classifyFailure("something nobody has seen"), "OTHER")
    })

    it("returns OTHER for a null reason", () => {
        assert.equal(classifyFailure(null), "OTHER")
    })
})

describe("tallyFailures", () => {
    it("includes every category, so a zero is visible rather than absent", () => {
        const tally = tallyFailures([])
        for (const c of FAILURE_CATEGORIES) {
            assert.equal(tally[c], 0, `missing category ${c}`)
        }
    })

    it("counts each reason once", () => {
        const rowCount = reasonFor([{ a: 1 }], [{ a: 1 }, { a: 2 }])
        const tally = tallyFailures([rowCount, rowCount, null])
        assert.equal(tally.ROW_COUNT, 2)
        assert.equal(tally.OTHER, 1)
    })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test scripts/test-analytics-failure-taxonomy.ts`
Expected: FAIL — cannot resolve `../lib/analytics/failure-taxonomy`.

- [ ] **Step 3: Implement**

Create `lib/analytics/failure-taxonomy.ts`:

```ts
/**
 * Classify a Submission.reason into a small, stable set of categories.
 *
 * `Submission.reason` is free text with runtime values interpolated by
 * lib/sql-validator.ts ("Row count mismatch — got 3, expected 5."), so
 * GROUP BY reason is useless — the numbers make nearly every row unique.
 * Classification happens at read time, which also means it applies
 * retroactively to every submission already stored; a new column could
 * only describe rows written after its migration.
 *
 * Matching is on the stable prefix of each message, never on the
 * interpolated values.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

export type FailureCategory =
    | "ROW_COUNT"
    | "COLUMN_MISMATCH"
    | "ROW_CONTENT"
    | "MALFORMED_RESULT"
    | "PROBLEM_DEFECT"
    | "OTHER"

export const FAILURE_CATEGORIES: readonly FailureCategory[] = [
    "ROW_COUNT",
    "COLUMN_MISMATCH",
    "ROW_CONTENT",
    "MALFORMED_RESULT",
    "PROBLEM_DEFECT",
    "OTHER",
] as const

export const FAILURE_LABELS: Record<FailureCategory, string> = {
    ROW_COUNT: "Wrong number of rows",
    COLUMN_MISMATCH: "Wrong columns",
    ROW_CONTENT: "Wrong values",
    MALFORMED_RESULT: "Result not a row set",
    PROBLEM_DEFECT: "Problem's expected output is malformed",
    OTHER: "Unclassified",
}

export function classifyFailure(reason: string | null): FailureCategory {
    if (!reason) return "OTHER"

    // PROBLEM_DEFECT is checked first: it indicates a broken problem, not
    // a struggling learner, and is the one category that is an authoring
    // bug rather than a wrong answer.
    if (reason.startsWith("Expected output is malformed")) return "PROBLEM_DEFECT"
    if (reason.startsWith("Row count mismatch")) return "ROW_COUNT"
    if (reason.startsWith("Column mismatch")) return "COLUMN_MISMATCH"
    if (reason.startsWith("Your result is not an array of rows")) {
        return "MALFORMED_RESULT"
    }
    // Two validator paths produce a values mismatch: the ordered
    // comparison ("Row 4 differs from expected.") and the
    // order-insensitive one ("Rows do not match (order-insensitive)...").
    if (/^Row \d+ differs from expected/.test(reason)) return "ROW_CONTENT"
    if (reason.startsWith("Rows do not match")) return "ROW_CONTENT"

    return "OTHER"
}

/** Every category is present in the result, including zeros — a category
 *  missing from the output would render as absent rather than as none. */
export function tallyFailures(
    reasons: (string | null)[]
): Record<FailureCategory, number> {
    const tally = Object.fromEntries(
        FAILURE_CATEGORIES.map((c) => [c, 0])
    ) as Record<FailureCategory, number>

    for (const reason of reasons) {
        tally[classifyFailure(reason)]++
    }
    return tally
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test scripts/test-analytics-failure-taxonomy.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Prove the test is non-vacuous**

Temporarily change `"Row count mismatch"` in `lib/analytics/failure-taxonomy.ts` to `"Row count mismatched"` and re-run.
Expected: FAIL on the row-count test. Revert the change and confirm the suite is green again. This proves the suite is coupled to the real validator output rather than to copied strings.

- [ ] **Step 6: Wire into `package.json` and CI**

```json
"test:analytics-failure-taxonomy": "node --import tsx --test scripts/test-analytics-failure-taxonomy.ts",
```

```yaml
      - name: Test analytics failure taxonomy
        run: npm run test:analytics-failure-taxonomy
```

- [ ] **Step 7: Commit**

```bash
git add lib/analytics/failure-taxonomy.ts scripts/test-analytics-failure-taxonomy.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): classify submission failures from validator output"
```

---

### Task 6: `counter-drift.ts` — denormalized counters vs truth

**Files:**
- Create: `lib/analytics/counter-drift.ts`
- Test: `scripts/test-analytics-counter-drift.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Background:** `SQLProblem.attemptCount` / `acceptedCount` are incremented in the same transaction that writes a `Submission` (`actions/submissions.ts:130-135`). The schema comment records the flaw: deleting a user cascades their submissions away and nothing decrements the counters, so counters run **ahead** of truth. `/practice` renders pass rates from these counters because it needs O(1) per row; analytics computes from `Submission` rows. The portal reports truth and surfaces the divergence rather than hiding it.

**Interfaces:**
- Produces:
  - `type ProblemCounters = { problemId: string; number: number; title: string; attemptCount: number; acceptedCount: number }`
  - `type TrueCounts = { attempts: number; accepted: number }`
  - `type DriftRow = { problemId: string; number: number; title: string; attemptDrift: number; acceptedDrift: number }`
  - `type DriftReport = { checked: number; drifted: DriftRow[] }`
  - `findDrift(counters: ProblemCounters[], truth: Map<string, TrueCounts>): DriftReport`

Drift is `counter - truth`; positive means the counter is ahead (the documented deletion case).

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-counter-drift.ts`:

```ts
// Unit tests for denormalized counter drift detection.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-counter-drift.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { findDrift } from "../lib/analytics/counter-drift"

const problem = (
    id: string,
    attemptCount: number,
    acceptedCount: number
) => ({ problemId: id, number: 1, title: `P-${id}`, attemptCount, acceptedCount })

describe("findDrift", () => {
    it("reports no drift when counters match truth", () => {
        const report = findDrift(
            [problem("a", 10, 4)],
            new Map([["a", { attempts: 10, accepted: 4 }]])
        )
        assert.equal(report.checked, 1)
        assert.deepEqual(report.drifted, [])
    })

    it("detects counters running ahead — the user-deletion case", () => {
        const report = findDrift(
            [problem("a", 10, 4)],
            new Map([["a", { attempts: 7, accepted: 3 }]])
        )
        assert.equal(report.drifted.length, 1)
        assert.equal(report.drifted[0].attemptDrift, 3)
        assert.equal(report.drifted[0].acceptedDrift, 1)
    })

    it("detects counters running behind as negative drift", () => {
        const report = findDrift(
            [problem("a", 2, 0)],
            new Map([["a", { attempts: 5, accepted: 1 }]])
        )
        assert.equal(report.drifted[0].attemptDrift, -3)
        assert.equal(report.drifted[0].acceptedDrift, -1)
    })

    it("treats a problem with no submissions as truth zero, not as missing", () => {
        const report = findDrift([problem("a", 3, 1)], new Map())
        assert.equal(report.drifted.length, 1)
        assert.equal(report.drifted[0].attemptDrift, 3)
    })

    it("does not flag an untouched problem whose counters are both zero", () => {
        const report = findDrift([problem("a", 0, 0)], new Map())
        assert.deepEqual(report.drifted, [])
    })

    it("flags a problem drifting only in acceptedCount", () => {
        const report = findDrift(
            [problem("a", 10, 5)],
            new Map([["a", { attempts: 10, accepted: 4 }]])
        )
        assert.equal(report.drifted.length, 1)
        assert.equal(report.drifted[0].attemptDrift, 0)
        assert.equal(report.drifted[0].acceptedDrift, 1)
    })

    it("counts every problem checked, not only the drifted ones", () => {
        const report = findDrift(
            [problem("a", 1, 0), problem("b", 2, 0), problem("c", 3, 0)],
            new Map([
                ["a", { attempts: 1, accepted: 0 }],
                ["b", { attempts: 2, accepted: 0 }],
                ["c", { attempts: 3, accepted: 0 }],
            ])
        )
        assert.equal(report.checked, 3)
        assert.equal(report.drifted.length, 0)
    })

    it("orders drifted problems by total magnitude, worst first", () => {
        const report = findDrift(
            [problem("small", 1, 0), problem("big", 50, 0)],
            new Map([
                ["small", { attempts: 0, accepted: 0 }],
                ["big", { attempts: 0, accepted: 0 }],
            ])
        )
        assert.equal(report.drifted[0].problemId, "big")
    })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test scripts/test-analytics-counter-drift.ts`
Expected: FAIL — cannot resolve `../lib/analytics/counter-drift`.

- [ ] **Step 3: Implement**

Create `lib/analytics/counter-drift.ts`:

```ts
/**
 * Compare SQLProblem's denormalized pass-rate counters against the truth
 * computed from Submission rows.
 *
 * The counters are maintained in the same transaction that writes a
 * Submission, but nothing decrements them when a User is deleted and
 * their submissions cascade away — so they run ahead. /practice renders
 * pass rates from them because it needs O(1) per row over the whole
 * catalog. Analytics reports truth and surfaces the divergence instead of
 * hiding it by reading the same drifting numbers.
 *
 * Repair path for a non-zero report: `npm run verify:pass-rate -- --fix`.
 *
 * No Prisma, no React, no next/*, no DOM.
 */

export type ProblemCounters = {
    problemId: string
    number: number
    title: string
    attemptCount: number
    acceptedCount: number
}

export type TrueCounts = {
    attempts: number
    accepted: number
}

export type DriftRow = {
    problemId: string
    number: number
    title: string
    /** counter minus truth; positive means the counter is ahead. */
    attemptDrift: number
    acceptedDrift: number
}

export type DriftReport = {
    /** How many problems were compared — needed so "0 drifted" can be
     *  reported as a checked result rather than as nothing happening. */
    checked: number
    drifted: DriftRow[]
}

export function findDrift(
    counters: ProblemCounters[],
    truth: Map<string, TrueCounts>
): DriftReport {
    const drifted: DriftRow[] = []

    for (const p of counters) {
        // A problem absent from `truth` has no submissions, which is a
        // real zero — not missing data.
        const actual = truth.get(p.problemId) ?? { attempts: 0, accepted: 0 }
        const attemptDrift = p.attemptCount - actual.attempts
        const acceptedDrift = p.acceptedCount - actual.accepted

        if (attemptDrift !== 0 || acceptedDrift !== 0) {
            drifted.push({
                problemId: p.problemId,
                number: p.number,
                title: p.title,
                attemptDrift,
                acceptedDrift,
            })
        }
    }

    drifted.sort(
        (a, b) =>
            Math.abs(b.attemptDrift) + Math.abs(b.acceptedDrift) -
            (Math.abs(a.attemptDrift) + Math.abs(a.acceptedDrift))
    )

    return { checked: counters.length, drifted }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test scripts/test-analytics-counter-drift.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Wire into `package.json` and CI**

```json
"test:analytics-counter-drift": "node --import tsx --test scripts/test-analytics-counter-drift.ts",
```

```yaml
      - name: Test analytics counter drift
        run: npm run test:analytics-counter-drift
```

- [ ] **Step 6: Commit**

```bash
git add lib/analytics/counter-drift.ts scripts/test-analytics-counter-drift.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): detect denormalized counter drift"
```

---

### Task 7: Read layer and snapshot cron

**Files:**
- Create: `lib/analytics/analytics-read.ts`
- Create: `app/api/cron/analytics-snapshot/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- Consumes: everything produced by Tasks 2–6; `prisma` from `lib/prisma.ts`; `toDayKey` from `lib/profile-stats.ts`.
- Produces:
  - `getPlatformSeries(windowDays: number, endDay: Date): Promise<PlatformSeries>`
  - `getRetentionInputs(windowDays: number, endDay: Date): Promise<{ cohorts: Map<string, string[]>; activityByUser: Map<string, Set<string>> }>`
  - `getFunnelCounts(windowDays: number, endDay: Date): Promise<{ signedUp: number; submitted: number; accepted: number }>`
  - `getProblemPerformance(): Promise<ProblemPerformanceRow[]>`
  - `getCounterDriftReport(): Promise<DriftReport>`
  - `writeDailySnapshot(day: string): Promise<void>`

**This file must NOT carry a `"use server"` directive.** Every export of a `"use server"` module becomes a client-callable RPC endpoint; these are admin reads called from a server component, and none of them resolves a session.

- [ ] **Step 1: Implement the read layer**

Create `lib/analytics/analytics-read.ts`:

```ts
/**
 * Prisma reads for the analytics portal.
 *
 * Deliberately NOT a "use server" module — every export of one becomes a
 * client-callable RPC endpoint, and none of these resolve a session. The
 * ADMIN gate lives on the page (requireAdminPage).
 *
 * This file holds queries only. All decision logic lives in the pure
 * sibling modules so it can be unit-tested without a database; anything
 * with a branch worth testing belongs there, not here.
 *
 * Submission.code is @db.Text and is never selected.
 */

import { prisma } from "../prisma"
import { toDayKey } from "../profile-stats"
import { windowBounds, dailySeries, type DayBucket } from "./metric-windows"
import { findDrift, type DriftReport } from "./counter-drift"

export type PlatformSeries = {
    signups: DayBucket[]
    submissions: DayBucket[]
    accepted: DayBucket[]
    /** Distinct users with a submission, per day. Submission is
     *  append-only, so this is a genuine historical series. */
    practiceActive: DayBucket[]
    /** Lessons completed per day. `completedAt` is write-once — see the
     *  COALESCE in lib/curriculum-write.ts — so this is also genuine. */
    lessonsCompleted: DayBucket[]
    /**
     * Distinct learners who touched a lesson anywhere in the window.
     *
     * A WINDOW TOTAL, deliberately not a series. LessonProgress holds one
     * mutable row per (userId, articleId) with `updatedAt @updatedAt` and
     * no createdAt, so a row records only its most recent touch. A per-day
     * breakdown would be accurate for today and undercount every earlier
     * day by exactly the learners who came back — a fabricated trend.
     *
     * The window aggregate is sound: for a window ending today no row can
     * be stamped later, so "distinct users with a row in the window" is
     * exactly "users who touched a lesson in the window".
     */
    learnActiveInWindow: number
}

export type ProblemPerformanceRow = {
    problemId: string
    number: number
    title: string
    slug: string
    attempts: number
    accepted: number
    distinctSolvers: number
    firstTryAccepted: number
    distinctAttempters: number
}

export async function getPlatformSeries(
    windowDays: number,
    endDay: Date
): Promise<PlatformSeries> {
    const { start, end } = windowBounds(windowDays, endDay)
    const range = { gte: start, lt: end }

    const [users, submissions, completions, learnActiveRows] = await Promise.all([
        prisma.user.findMany({
            where: { createdAt: range },
            select: { createdAt: true },
        }),
        prisma.submission.findMany({
            where: { createdAt: range },
            select: { createdAt: true, status: true, userId: true },
        }),
        // completedAt is nullable; a range filter excludes nulls, so this
        // returns only genuine completions.
        prisma.lessonProgress.findMany({
            where: { completedAt: range },
            select: { completedAt: true },
        }),
        // Window total only — see the comment on learnActiveInWindow for
        // why this must not be broken down by day.
        prisma.lessonProgress.findMany({
            where: { updatedAt: range },
            select: { userId: true },
            distinct: ["userId"],
        }),
    ])

    return {
        signups: dailySeries(users.map((u) => u.createdAt), windowDays, endDay),
        submissions: dailySeries(
            submissions.map((s) => s.createdAt),
            windowDays,
            endDay
        ),
        accepted: dailySeries(
            submissions.filter((s) => s.status === "ACCEPTED").map((s) => s.createdAt),
            windowDays,
            endDay
        ),
        practiceActive: distinctUsersPerDay(
            submissions.map((s) => ({ userId: s.userId, at: s.createdAt })),
            windowDays,
            endDay
        ),
        lessonsCompleted: dailySeries(
            completions
                .map((c) => c.completedAt)
                .filter((d): d is Date => d !== null),
            windowDays,
            endDay
        ),
        learnActiveInWindow: learnActiveRows.length,
    }
}

/** One synthetic date per (day, user) pair, so the shared series builder
 *  counts distinct users rather than events. */
function distinctUsersPerDay(
    events: { userId: string; at: Date }[],
    windowDays: number,
    endDay: Date
): DayBucket[] {
    const seen = new Set<string>()
    const firsts: Date[] = []
    for (const e of events) {
        const key = `${toDayKey(e.at)}:${e.userId}`
        if (seen.has(key)) continue
        seen.add(key)
        firsts.push(e.at)
    }
    return dailySeries(firsts, windowDays, endDay)
}

export async function getRetentionInputs(
    windowDays: number,
    endDay: Date
): Promise<{
    cohorts: Map<string, string[]>
    activityByUser: Map<string, Set<string>>
}> {
    const { start, end } = windowBounds(windowDays, endDay)

    const users = await prisma.user.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { id: true, createdAt: true },
    })

    const cohorts = new Map<string, string[]>()
    for (const u of users) {
        const key = toDayKey(u.createdAt)
        const bucket = cohorts.get(key)
        if (bucket) bucket.push(u.id)
        else cohorts.set(key, [u.id])
    }

    const userIds = users.map((u) => u.id)
    const activityByUser = new Map<string, Set<string>>()
    if (userIds.length > 0) {
        // Activity is looked up without an upper bound: a cohort member's
        // return can fall after the window's end day.
        const [subs, lessons] = await Promise.all([
            prisma.submission.findMany({
                where: { userId: { in: userIds } },
                select: { userId: true, createdAt: true },
            }),
            prisma.lessonProgress.findMany({
                where: { userId: { in: userIds } },
                select: { userId: true, updatedAt: true },
            }),
        ])
        for (const s of subs) addActivity(activityByUser, s.userId, s.createdAt)
        for (const l of lessons) addActivity(activityByUser, l.userId, l.updatedAt)
    }

    return { cohorts, activityByUser }
}

function addActivity(
    map: Map<string, Set<string>>,
    userId: string,
    at: Date
): void {
    const set = map.get(userId)
    if (set) set.add(toDayKey(at))
    else map.set(userId, new Set([toDayKey(at)]))
}

export async function getFunnelCounts(
    windowDays: number,
    endDay: Date
): Promise<{ signedUp: number; submitted: number; accepted: number }> {
    const { start, end } = windowBounds(windowDays, endDay)

    const users = await prisma.user.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: { id: true },
    })
    const userIds = users.map((u) => u.id)
    if (userIds.length === 0) {
        return { signedUp: 0, submitted: 0, accepted: 0 }
    }

    const [submitted, accepted] = await Promise.all([
        prisma.submission.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true },
            distinct: ["userId"],
        }),
        prisma.submission.findMany({
            where: { userId: { in: userIds }, status: "ACCEPTED" },
            select: { userId: true },
            distinct: ["userId"],
        }),
    ])

    return {
        signedUp: userIds.length,
        submitted: submitted.length,
        accepted: accepted.length,
    }
}

export async function getProblemPerformance(): Promise<ProblemPerformanceRow[]> {
    const problems = await prisma.sQLProblem.findMany({
        where: { status: "PUBLISHED" },
        select: { id: true, number: true, title: true, slug: true },
        orderBy: { number: "asc" },
    })

    const submissions = await prisma.submission.findMany({
        select: {
            problemId: true,
            userId: true,
            status: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    })

    const byProblem = new Map<
        string,
        {
            attempts: number
            accepted: number
            solvers: Set<string>
            attempters: Set<string>
            firstSeen: Map<string, boolean>
        }
    >()

    for (const s of submissions) {
        let agg = byProblem.get(s.problemId)
        if (!agg) {
            agg = {
                attempts: 0,
                accepted: 0,
                solvers: new Set(),
                attempters: new Set(),
                firstSeen: new Map(),
            }
            byProblem.set(s.problemId, agg)
        }
        agg.attempts++
        agg.attempters.add(s.userId)
        if (s.status === "ACCEPTED") {
            agg.accepted++
            agg.solvers.add(s.userId)
        }
        // Submissions arrive oldest-first, so the first row seen for a
        // user is their first attempt at this problem.
        if (!agg.firstSeen.has(s.userId)) {
            agg.firstSeen.set(s.userId, s.status === "ACCEPTED")
        }
    }

    return problems.map((p) => {
        const agg = byProblem.get(p.id)
        return {
            problemId: p.id,
            number: p.number,
            title: p.title,
            slug: p.slug,
            attempts: agg?.attempts ?? 0,
            accepted: agg?.accepted ?? 0,
            distinctSolvers: agg?.solvers.size ?? 0,
            distinctAttempters: agg?.attempters.size ?? 0,
            firstTryAccepted: agg
                ? [...agg.firstSeen.values()].filter(Boolean).length
                : 0,
        }
    })
}

export async function getCounterDriftReport(): Promise<DriftReport> {
    const [problems, grouped] = await Promise.all([
        prisma.sQLProblem.findMany({
            select: {
                id: true,
                number: true,
                title: true,
                attemptCount: true,
                acceptedCount: true,
            },
        }),
        prisma.submission.groupBy({
            by: ["problemId", "status"],
            _count: { _all: true },
        }),
    ])

    const truth = new Map<string, { attempts: number; accepted: number }>()
    for (const row of grouped) {
        const cur = truth.get(row.problemId) ?? { attempts: 0, accepted: 0 }
        cur.attempts += row._count._all
        if (row.status === "ACCEPTED") cur.accepted += row._count._all
        truth.set(row.problemId, cur)
    }

    return findDrift(
        problems.map((p) => ({
            problemId: p.id,
            number: p.number,
            title: p.title,
            attemptCount: p.attemptCount,
            acceptedCount: p.acceptedCount,
        })),
        truth
    )
}

/**
 * Write the point-in-time snapshot for `day`. The primary-key upsert creates
 * it once; a retry preserves the original value rather than rewriting it.
 *
 * Only non-recomputable state belongs here. Anything derivable from a
 * createdAt/completedAt timestamp is computed live instead.
 */
export async function writeDailySnapshot(day: string): Promise<void> {
    const [
        registeredUsers,
        publishedProblems,
        publishedArticles,
        publishedTracks,
        lessonsInProgress,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.sQLProblem.count({ where: { status: "PUBLISHED" } }),
        prisma.article.count({ where: { status: "PUBLISHED" } }),
        prisma.track.count({ where: { status: "PUBLISHED" } }),
        prisma.lessonProgress.count({
            where: { completedAt: null, percent: { gt: 0 } },
        }),
    ])

    const values = {
        registeredUsers,
        publishedProblems,
        publishedArticles,
        publishedTracks,
        lessonsInProgress,
    }

    await prisma.metricSnapshot.upsert({
        where: { day },
        create: { day, ...values },
        update: {},
    })
}
```

- [ ] **Step 2: Verify the Article/Track status values compile**

Run: `npx tsc --noEmit`
Expected: exit 0. If `Article.status` or `Track.status` does not accept `"PUBLISHED"`, read the enum in `prisma/schema.prisma` (`ArticleStatus`, `TrackStatus`) and use the correct member — do not cast.

- [ ] **Step 3: Create the cron route**

Create `app/api/cron/analytics-snapshot/route.ts`, following the `CRON_SECRET` pattern in `app/api/cron/asset-gc/route.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server"
import { writeDailySnapshot } from "@/lib/analytics/analytics-read"
import { toDayKey } from "@/lib/profile-stats"

function isAuthorized(req: NextRequest): boolean {
    const secret = process.env.CRON_SECRET
    return Boolean(secret) && req.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: "forbidden" }, { status: 403 })
    }

    // Capture live state at the first run in the current UTC day. A retry
    // cannot rewrite it, so the point-in-time value stays internally honest.
    const day = toDayKey(new Date())

    await writeDailySnapshot(day)

    return NextResponse.json({ ok: true, day })
}
```

- [ ] **Step 4: Register the cron**

Modify `vercel.json` to add a third entry:

```json
{
  "crons": [
    { "path": "/api/cron/asset-gc", "schedule": "0 4 * * *" },
    { "path": "/api/contests/sweep-locks", "schedule": "0 5 * * *" },
    { "path": "/api/cron/analytics-snapshot", "schedule": "0 6 * * *" }
  ]
}
```

Vercel Hobby permits 100 cron jobs per project at a minimum interval of once per day, so a third daily entry is within limits.

- [ ] **Step 5: Verify the cron end to end, including idempotency**

With the dev server running against local Postgres:

```bash
CRON_SECRET=localdev npm run dev
# in another shell:
curl -s -H "Authorization: Bearer localdev" http://localhost:3000/api/cron/analytics-snapshot
curl -s -H "Authorization: Bearer localdev" http://localhost:3000/api/cron/analytics-snapshot
```

Expected: both return `{"ok":true,"day":"<current UTC day>"}`. Then confirm exactly one row exists for that day:

```bash
psql postgresql://anchitgupta@localhost:5432/datalearn -c \
  "SELECT count(*) FROM \"MetricSnapshot\" WHERE day = '<current UTC day>';"
```

Expected: `1`. Two rows means the upsert key is wrong; changing source state between the two calls must not rewrite the row.

Also verify the gate rejects an unauthenticated call:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/analytics-snapshot
```

Expected: `403`.

- [ ] **Step 6: Confirm the read layer is not a server module**

Run:

```bash
head -5 lib/analytics/analytics-read.ts | grep -c "use server"
```

Expected: `0`. A `"use server"` directive here would expose every read as a client-callable endpoint.

- [ ] **Step 7: Build and commit**

```bash
npm run build
git add lib/analytics/analytics-read.ts app/api/cron/analytics-snapshot/route.ts vercel.json
git commit -m "feat(analytics): read layer and idempotent daily snapshot cron"
```

- [ ] **Step 8: Open the Phase 1 PR**

```bash
git push -u origin <branch>
gh pr create --base main --title "feat(analytics): V11 foundation — schema, pure modules, snapshot cron" --body "<per .github/PULL_REQUEST_TEMPLATE.md>"
```

The `--base main` flag is mandatory. Without it the PR targets `production` and deploys to live.

---

## Phase 2 — Platform section (PR 2)

### Task 8: `StatTile` — a metric tile with honest polarity

**Files:**
- Create: `lib/analytics/delta-tone.ts`
- Create: `components/admin/analytics/StatTile.tsx`
- Test: `scripts/test-analytics-stat-tile.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Why a new component rather than reusing `MetricCard`:** `MetricCard` renders as a `<Link>` and its `AdminMetric` type requires `href: string`, but several analytics figures (retention, active users) have no meaningful destination — inventing a placeholder href would be dishonest navigation. More importantly its `DELTA_COLOR` map hardcodes `up → text-easy` (green) and `down → text-destructive` (red), which is wrong for any metric where rising is bad. `StatTile` takes an explicit polarity.

**Interfaces:**
- Consumes: `computeDelta` and `MetricDelta` from `lib/admin/metric-delta.ts`.
- Produces:
  - `type Polarity = "up-good" | "up-bad" | "neutral"`
  - `deltaToneFor(direction: DeltaDirection, polarity: Polarity): "positive" | "negative" | "neutral"` (exported from `lib/analytics/delta-tone.ts`)
  - `<StatTile label value delta polarity href? footnote? />`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-analytics-stat-tile.ts`:

```ts
// Unit tests for delta tone selection.
// Pure — no React rendering, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-analytics-stat-tile.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { deltaToneFor } from "../lib/analytics/delta-tone"

describe("deltaToneFor", () => {
    it("treats growth as positive for an up-good metric", () => {
        assert.equal(deltaToneFor("up", "up-good"), "positive")
    })

    it("treats decline as negative for an up-good metric", () => {
        assert.equal(deltaToneFor("down", "up-good"), "negative")
    })

    // The defect this exists to prevent: rendering "failures up 40%" in
    // the same green used for "sign-ups up 40%".
    it("treats growth as NEGATIVE for an up-bad metric", () => {
        assert.equal(deltaToneFor("up", "up-bad"), "negative")
    })

    it("treats decline as POSITIVE for an up-bad metric", () => {
        assert.equal(deltaToneFor("down", "up-bad"), "positive")
    })

    it("never colours a neutral metric", () => {
        assert.equal(deltaToneFor("up", "neutral"), "neutral")
        assert.equal(deltaToneFor("down", "neutral"), "neutral")
    })

    it("treats flat as neutral regardless of polarity", () => {
        assert.equal(deltaToneFor("flat", "up-good"), "neutral")
        assert.equal(deltaToneFor("flat", "up-bad"), "neutral")
    })
})
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test scripts/test-analytics-stat-tile.ts`
Expected: FAIL — cannot resolve `../lib/analytics/delta-tone`.

- [ ] **Step 3: Implement the pure tone module**

Create `lib/analytics/delta-tone.ts`:

```ts
/**
 * Map a delta direction to a visual tone, given what the metric means.
 *
 * components/admin/MetricCard.tsx hardcodes up=green / down=red, which is
 * correct for sign-ups and wrong for failure counts. Analytics metrics
 * declare their polarity so a rising failure count is never rendered in
 * the colour that means "good".
 *
 * No Prisma, no React, no next/*, no DOM.
 */

import type { DeltaDirection } from "../admin/metric-delta"

export type Polarity = "up-good" | "up-bad" | "neutral"
export type DeltaTone = "positive" | "negative" | "neutral"

export function deltaToneFor(
    direction: DeltaDirection,
    polarity: Polarity
): DeltaTone {
    if (direction === "flat" || polarity === "neutral") return "neutral"
    if (polarity === "up-good") return direction === "up" ? "positive" : "negative"
    return direction === "up" ? "negative" : "positive"
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test scripts/test-analytics-stat-tile.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Implement the tile**

Create `components/admin/analytics/StatTile.tsx`:

```tsx
import Link from "next/link"
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react"
import type { MetricDelta } from "@/lib/admin/metric-delta"
import { deltaToneFor, type DeltaTone, type Polarity } from "@/lib/analytics/delta-tone"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { cn } from "@/lib/utils"

const TONE_CLASS: Record<DeltaTone, string> = {
    positive: "text-easy",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
}

const DIRECTION_ICON: Record<string, LucideIcon> = {
    up: ArrowUp,
    down: ArrowDown,
    flat: Minus,
}

export function StatTile({
    label,
    value,
    delta,
    polarity = "neutral",
    href,
    footnote,
}: {
    label: string
    value: string
    /** Absent when no honest delta exists — render nothing, not a zero. */
    delta?: MetricDelta | null
    polarity?: Polarity
    href?: string
    /** e.g. the denominator behind a percentage. */
    footnote?: string
}) {
    const tone = delta ? deltaToneFor(delta.direction, polarity) : "neutral"
    const Icon = delta ? DIRECTION_ICON[delta.direction] : null

    const body = (
        <>
            <Eyebrow>{label}</Eyebrow>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
            {delta && Icon ? (
                <div className={cn("mt-2 flex items-center gap-1 text-sm tabular-nums", TONE_CLASS[tone])}>
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                        {delta.change > 0 ? "+" : ""}
                        {delta.change.toLocaleString()}
                    </span>
                </div>
            ) : null}
            {footnote ? (
                <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>
            ) : null}
        </>
    )

    const className =
        "block rounded-lg border border-border bg-surface p-4"

    return href ? (
        <Link href={href} className={cn(className, "transition-colors hover:border-border-strong hover:bg-surface-hover")}>
            {body}
        </Link>
    ) : (
        <div className={className}>{body}</div>
    )
}
```

- [ ] **Step 6: Wire into `package.json` and CI**

```json
"test:analytics-stat-tile": "node --import tsx --test scripts/test-analytics-stat-tile.ts",
```

```yaml
      - name: Test analytics delta tone
        run: npm run test:analytics-stat-tile
```

- [ ] **Step 7: Verify tokens and commit**

```bash
npm run check:token-parity
git add lib/analytics/delta-tone.ts components/admin/analytics/StatTile.tsx scripts/test-analytics-stat-tile.ts package.json .github/workflows/test.yml
git commit -m "feat(analytics): stat tile with explicit metric polarity"
```

---

### Task 9: The analytics page and platform section

**Files:**
- Create: `app/admin/analytics/page.tsx`
- Create: `components/admin/analytics/PlatformSection.tsx`
- Create: `components/admin/analytics/RetentionTable.tsx`
- Create: `components/admin/analytics/FunnelBar.tsx`
- Modify: `lib/admin/admin-nav-model.ts`

**Interfaces:**
- Consumes: `requireAdminPage()` from `lib/admin-page-auth.ts`; `getPlatformSeries`, `getRetentionInputs`, `getFunnelCounts` from `lib/analytics/analytics-read.ts`; `cohortRetention`, `RETENTION_BUCKETS`; `buildFunnel`; `computeDelta`; `StatTile`.

- [ ] **Step 1: Add the nav entry**

In `lib/admin/admin-nav-model.ts`, add to the ungrouped leading group, directly after the `overview` item:

```ts
            {
                key: "analytics",
                label: "Analytics",
                icon: ChartLine,
                href: "/admin/analytics",
            },
```

Add `ChartLine` to the existing `lucide-react` import at the top of the file. Do **not** set `requiresDiscussionQueuePermission` — this item is ADMIN-only and `visibleAdminNav` already hides non-permission items from MODERATOR.

- [ ] **Step 2: Verify the nav test still passes**

Run: `npm run test:admin-nav`
Expected: PASS. If a test asserts an exact item count for the ungrouped group, update that count — do not delete the assertion.

- [ ] **Step 3: Create the page**

Create `app/admin/analytics/page.tsx`:

```tsx
import type { Metadata } from "next"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { Container } from "@/components/ui/Container"
import { PlatformSection } from "@/components/admin/analytics/PlatformSection"

export const metadata: Metadata = {
    title: "Analytics",
    robots: { index: false, follow: false },
}

// Always reflect current data; this page is admin-only and low-traffic.
export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
    await requireAdminPage()

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <h1 className="text-2xl font-semibold">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
                Platform health over the last 30 days. Days are UTC.
            </p>
            <PlatformSection windowDays={30} />
        </Container>
    )
}
```

- [ ] **Step 4: Create the platform section**

Create `components/admin/analytics/PlatformSection.tsx`:

```tsx
import {
    getFunnelCounts,
    getPlatformSeries,
    getRetentionInputs,
} from "@/lib/analytics/analytics-read"
import { cohortRetention, RETENTION_BUCKETS } from "@/lib/analytics/retention"
import { buildFunnel } from "@/lib/analytics/funnel"
import { computeDelta } from "@/lib/admin/metric-delta"
import { StatTile } from "./StatTile"
import { RetentionTable } from "./RetentionTable"
import { FunnelBar } from "./FunnelBar"
import type { DayBucket } from "@/lib/analytics/metric-windows"

function total(series: DayBucket[]): number {
    return series.reduce((sum, b) => sum + b.count, 0)
}

/** Sum of the first half vs the second half of the window, so the delta
 *  compares like with like. Returns null when the window is too short to
 *  split, so no delta is rendered rather than a fabricated one. */
function previousHalf(series: DayBucket[]): number | null {
    if (series.length < 2) return null
    const mid = Math.floor(series.length / 2)
    return total(series.slice(0, mid))
}

function currentHalf(series: DayBucket[]): number {
    const mid = Math.floor(series.length / 2)
    return total(series.slice(mid))
}

export async function PlatformSection({ windowDays }: { windowDays: number }) {
    const today = new Date()

    const [series, retentionInputs, funnelCounts] = await Promise.all([
        getPlatformSeries(windowDays, today),
        getRetentionInputs(windowDays, today),
        getFunnelCounts(windowDays, today),
    ])

    const submissions = total(series.submissions)
    const accepted = total(series.accepted)

    const funnel = buildFunnel([
        { key: "signup", label: "Signed up", count: funnelCounts.signedUp },
        { key: "submitted", label: "Made a submission", count: funnelCounts.submitted },
        { key: "accepted", label: "Solved a problem", count: funnelCounts.accepted },
    ])

    return (
        <div className="mt-8 space-y-10">
            <section aria-labelledby="platform-heading">
                <h2 id="platform-heading" className="text-lg font-semibold">
                    Platform
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatTile
                        label="Sign-ups"
                        value={total(series.signups).toLocaleString()}
                        delta={computeDelta(
                            currentHalf(series.signups),
                            previousHalf(series.signups)
                        )}
                        polarity="up-good"
                    />
                    <StatTile
                        label="Submissions"
                        value={submissions.toLocaleString()}
                        delta={computeDelta(
                            currentHalf(series.submissions),
                            previousHalf(series.submissions)
                        )}
                        polarity="up-good"
                    />
                    <StatTile
                        label="Acceptance rate"
                        value={
                            submissions === 0
                                ? "No submissions yet"
                                : `${Math.round((accepted / submissions) * 100)}%`
                        }
                        // Show the denominator: "100%" over 1 submission is
                        // not the same claim as 100% over 1,000.
                        footnote={
                            submissions === 0
                                ? undefined
                                : `${accepted.toLocaleString()} of ${submissions.toLocaleString()}`
                        }
                        polarity="up-good"
                    />
                    <StatTile
                        label="Problems solved"
                        value={accepted.toLocaleString()}
                        polarity="up-good"
                    />
                </div>
            </section>

            {/* Practice and learn activity are never summed: a learner who
                did both would be counted twice. They are also not the same
                shape — see the comment on learnActiveInWindow. */}
            <section aria-labelledby="activity-heading">
                <h2 id="activity-heading" className="text-lg font-semibold">
                    Active learners
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    Counted separately — someone can read a whole track without
                    submitting once. These figures are not added together.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                    <StatTile
                        label="Active in practice"
                        value={total(series.practiceActive).toLocaleString()}
                        footnote="User-days with a submission"
                        polarity="up-good"
                    />
                    {/* No delta: LessonProgress.updatedAt is overwritten, so
                        splitting this window in half would need per-day data
                        that does not exist. computeDelta is not called rather
                        than called with a fabricated previous value. */}
                    <StatTile
                        label="Active in lessons"
                        value={series.learnActiveInWindow.toLocaleString()}
                        footnote={`Distinct learners in the last ${windowDays} days`}
                        polarity="up-good"
                    />
                    <StatTile
                        label="Lessons completed"
                        value={total(series.lessonsCompleted).toLocaleString()}
                        delta={computeDelta(
                            currentHalf(series.lessonsCompleted),
                            previousHalf(series.lessonsCompleted)
                        )}
                        polarity="up-good"
                    />
                </div>
            </section>

            <section aria-labelledby="funnel-heading">
                <h2 id="funnel-heading" className="text-lg font-semibold">
                    New-user funnel
                </h2>
                <FunnelBar steps={funnel} />
            </section>

            <section aria-labelledby="retention-heading">
                <h2 id="retention-heading" className="text-lg font-semibold">
                    Retention
                </h2>
                {RETENTION_BUCKETS.map((bucket) => (
                    <RetentionTable
                        key={bucket}
                        bucketDays={bucket}
                        rows={cohortRetention(
                            retentionInputs.cohorts,
                            retentionInputs.activityByUser,
                            bucket,
                            today
                        )}
                    />
                ))}
            </section>
        </div>
    )
}
```

- [ ] **Step 5: Create `RetentionTable` with the insufficient-history state**

Create `components/admin/analytics/RetentionTable.tsx`:

```tsx
import type { CohortRetention } from "@/lib/analytics/retention"

export function RetentionTable({
    bucketDays,
    rows,
}: {
    bucketDays: number
    rows: CohortRetention[]
}) {
    if (rows.length === 0) {
        return (
            <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-medium">D{bucketDays}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                    No sign-ups in this window.
                </p>
            </div>
        )
    }

    return (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
                <caption className="px-4 pt-4 text-left text-sm font-medium">
                    D{bucketDays} retention
                </caption>
                <thead>
                    <tr className="text-left text-muted-foreground">
                        <th scope="col" className="px-4 py-2 font-medium">Cohort</th>
                        <th scope="col" className="px-4 py-2 font-medium">Signed up</th>
                        <th scope="col" className="px-4 py-2 font-medium">Retained</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.cohortDay} className="border-t border-border">
                            <td className="px-4 py-2 tabular-nums">{row.cohortDay}</td>
                            <td className="px-4 py-2 tabular-nums">{row.cohortSize}</td>
                            <td className="px-4 py-2 tabular-nums">
                                {/* null means the bucket day has not elapsed —
                                    say so. Rendering 0% would read as total
                                    churn rather than as "too early to tell". */}
                                {row.rate === null || row.retained === null ? (
                                    <span className="text-muted-foreground">
                                        Not enough history yet
                                    </span>
                                ) : (
                                    <>
                                        {Math.round(row.rate * 100)}%{" "}
                                        <span className="text-muted-foreground">
                                            ({row.retained} of {row.cohortSize})
                                        </span>
                                    </>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
```

- [ ] **Step 6: Create `FunnelBar`**

Create `components/admin/analytics/FunnelBar.tsx`:

```tsx
import type { FunnelStep } from "@/lib/analytics/funnel"

export function FunnelBar({ steps }: { steps: FunnelStep[] }) {
    if (steps.length === 0 || steps[0].count === 0) {
        return (
            <p className="mt-4 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
                No sign-ups in this window, so there is no funnel to report.
            </p>
        )
    }

    const first = steps[0].count

    return (
        <ol className="mt-4 space-y-3">
            {steps.map((step) => {
                const width = Math.max(2, Math.round((step.count / first) * 100))
                return (
                    <li key={step.key} className="rounded-lg border border-border bg-surface p-4">
                        <div className="flex items-baseline justify-between gap-4">
                            <span className="text-sm font-medium">{step.label}</span>
                            <span className="text-sm tabular-nums">
                                {step.count.toLocaleString()}
                                {step.rateFromPrevious !== null ? (
                                    <span className="ml-2 text-muted-foreground">
                                        {Math.round(step.rateFromPrevious * 100)}% of previous
                                    </span>
                                ) : null}
                            </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                            <div
                                className="h-2 rounded-full bg-primary"
                                style={{ width: `${width}%` }}
                            />
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}
```

- [ ] **Step 7: Verify build and tokens**

```bash
npx tsc --noEmit
npm run build
npm run check:token-parity
npm run test:console-nav
```

Expected: all exit 0. `test:console-nav` confirms admin is still a normal shell route.

- [ ] **Step 8: Commit**

```bash
git add app/admin/analytics components/admin/analytics lib/admin/admin-nav-model.ts
git commit -m "feat(analytics): platform section with retention and funnel"
```

---

### Task 10: E2E — access control and the empty-data path

**Files:**
- Create: `tests/e2e/admin-analytics.spec.ts`

**Interfaces:**
- Consumes: the existing e2e fixture helpers used by `tests/e2e/admin-shell.spec.ts` (read that file first for the sign-in and role-seeding pattern; reuse it rather than inventing a new one).

The CI database has no curriculum seeded, so the empty-data path is the state CI actually exercises. This is the shape that caused the v0.9.1 hotfix.

- [ ] **Step 1: Read the existing admin e2e for its fixture pattern**

Run: `cat tests/e2e/admin-shell.spec.ts`

Note how it signs in, assigns a role, prefixes fixture rows, and cleans up. Reuse that pattern exactly.

- [ ] **Step 2: Write the spec**

Create `tests/e2e/admin-analytics.spec.ts` with three tests:

1. **A non-admin is refused.** Sign in as a plain USER, navigate to `/admin/analytics`, expect a redirect away from the route (`requireAdminPage` redirects to `/`).
2. **A MODERATOR is refused.** Same, with role MODERATOR — this proves the ADMIN-only decision, which `requireAdminOrModeratorPage` would have broken.
3. **An ADMIN sees the page render with no data.** Expect the heading "Analytics" and the honest zero-state copy — the "No sign-ups in this window, so there is no funnel to report." string from `FunnelBar` — rather than an empty region or a `0%`.

Use `getByRole` and visible-text assertions; do not assert on class names.

- [ ] **Step 3: Prove each test is non-vacuous**

For test 3, temporarily change the `FunnelBar` empty-state copy and confirm the test fails; revert. For tests 1 and 2, temporarily swap `requireAdminPage()` for `requireAdminOrModeratorPage()` in the page and confirm the MODERATOR test fails; revert.

Record in the PR description that this was done and what failed.

- [ ] **Step 4: Run the suite**

Run: `npm run test:e2e -- admin-analytics`
Expected: 3 passed.

Playwright already discovers `tests/e2e`, so no workflow change is needed — confirm with `npx playwright test --list | grep admin-analytics` rather than assuming.

- [ ] **Step 5: Commit and open the Phase 2 PR**

```bash
git add tests/e2e/admin-analytics.spec.ts
git commit -m "test(analytics): admin-only access and empty-data rendering"
git push
gh pr create --base main --title "feat(analytics): V11 platform section" --body "<per template>"
```

---

## Phase 3 — Content performance (PR 3)

### Task 11: Per-problem table and per-track completion

**Files:**
- Create: `components/admin/analytics/ContentSection.tsx`
- Modify: `app/admin/analytics/page.tsx`
- Modify: `lib/analytics/analytics-read.ts` (add `getTrackCompletion`)

**Interfaces:**
- Consumes: `getProblemPerformance(): Promise<ProblemPerformanceRow[]>` from Task 7.
- Produces: `getTrackCompletion(): Promise<TrackCompletionRow[]>` where `TrackCompletionRow = { trackId: string; title: string; slug: string; lessonCount: number; learnersStarted: number; learnersCompleted: number }`.

- [ ] **Step 1: Add `getTrackCompletion` to the read layer**

Append to `lib/analytics/analytics-read.ts`:

```ts
export type TrackCompletionRow = {
    trackId: string
    title: string
    slug: string
    lessonCount: number
    learnersStarted: number
    learnersCompleted: number
}

export async function getTrackCompletion(): Promise<TrackCompletionRow[]> {
    const tracks = await prisma.track.findMany({
        where: { status: "PUBLISHED" },
        select: {
            id: true,
            title: true,
            slug: true,
            modules: {
                select: { lessons: { select: { articleId: true } } },
            },
        },
    })

    return Promise.all(
        tracks.map(async (t) => {
            const articleIds = t.modules.flatMap((m) =>
                m.lessons.map((l) => l.articleId)
            )
            if (articleIds.length === 0) {
                return {
                    trackId: t.id,
                    title: t.title,
                    slug: t.slug,
                    lessonCount: 0,
                    learnersStarted: 0,
                    learnersCompleted: 0,
                }
            }

            const progress = await prisma.lessonProgress.findMany({
                where: { articleId: { in: articleIds } },
                select: { userId: true, completedAt: true },
            })

            const started = new Set<string>()
            const completedCount = new Map<string, number>()
            for (const p of progress) {
                started.add(p.userId)
                if (p.completedAt) {
                    completedCount.set(
                        p.userId,
                        (completedCount.get(p.userId) ?? 0) + 1
                    )
                }
            }

            let learnersCompleted = 0
            for (const n of completedCount.values()) {
                if (n >= articleIds.length) learnersCompleted++
            }

            return {
                trackId: t.id,
                title: t.title,
                slug: t.slug,
                lessonCount: articleIds.length,
                learnersStarted: started.size,
                learnersCompleted,
            }
        })
    )
}
```

Verify the relation names against `prisma/schema.prisma` (`Track.modules`, `Module.lessons`, `ModuleLesson.articleId`) before running — if they differ, use the real names rather than casting.

- [ ] **Step 2: Create `ContentSection`**

Create `components/admin/analytics/ContentSection.tsx` rendering two tables.

**Per-problem table** columns: `#`, `Title` (linking to `/admin/analytics/problems/<slug>`, created in Phase 4 — until then link to `/problems/<slug>`), `Attempts`, `Solvers`, `Acceptance`, `First-try`.

Honesty requirements, each mandatory:

- A problem with zero attempts renders `—` in the acceptance column, never `0%`.
- Acceptance shows the denominator inline: `40% (4 of 10)`.
- First-try acceptance is expressed against distinct attempters, with that denominator shown.
- If no problems have any submissions, render the whole table region as a stated zero-state — "No submissions recorded yet." — rather than a table of dashes.

Sort by acceptance rate ascending (worst first), placing zero-attempt problems last, since the point of the table is finding broken problems.

- [ ] **Step 3: Add per-track completion**

In the same component, render a track table: `Track`, `Lessons`, `Learners started`, `Completed`. A track with `lessonCount === 0` renders "No lessons yet" in the completed column rather than `0%` — the exact shape that caused the v0.9.1 hotfix.

- [ ] **Step 4: Mount it on the page**

In `app/admin/analytics/page.tsx`, render `<ContentSection />` after `<PlatformSection windowDays={30} />`.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm run build
npm run check:token-parity
```

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add components/admin/analytics/ContentSection.tsx lib/analytics/analytics-read.ts app/admin/analytics/page.tsx
git commit -m "feat(analytics): per-problem and per-track content performance"
```

---

### Task 12: Counter-drift indicator

**Files:**
- Create: `components/admin/analytics/DriftIndicator.tsx`
- Modify: `components/admin/analytics/ContentSection.tsx`

**Interfaces:**
- Consumes: `getCounterDriftReport(): Promise<DriftReport>` from Task 7; `DriftReport = { checked: number; drifted: DriftRow[] }`.

- [ ] **Step 1: Create the component**

Create `components/admin/analytics/DriftIndicator.tsx`:

```tsx
import { CircleCheck, TriangleAlert } from "lucide-react"
import type { DriftReport } from "@/lib/analytics/counter-drift"

export function DriftIndicator({ report }: { report: DriftReport }) {
    // A zero result is stated, not omitted — silence is indistinguishable
    // from "never checked".
    if (report.drifted.length === 0) {
        return (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
                <CircleCheck className="mt-0.5 h-4 w-4 text-easy" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">
                    Pass-rate counters match submission history across all{" "}
                    {report.checked.toLocaleString()} problems.
                </p>
            </div>
        )
    }

    return (
        <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start gap-3">
                <TriangleAlert
                    className="mt-0.5 h-4 w-4 text-destructive"
                    aria-hidden="true"
                />
                <div>
                    <p className="text-sm font-medium">
                        {report.drifted.length.toLocaleString()} of{" "}
                        {report.checked.toLocaleString()} problems have drifted
                        pass-rate counters
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        The catalog shows pass rates from denormalized counters,
                        which are not decremented when a user is deleted. The
                        rates on this page are computed from submissions and are
                        correct. Repair the counters with{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs">
                            npm run verify:pass-rate -- --fix
                        </code>
                        .
                    </p>
                </div>
            </div>
            <ul className="mt-3 space-y-1 text-sm">
                {report.drifted.slice(0, 10).map((row) => (
                    <li key={row.problemId} className="tabular-nums text-muted-foreground">
                        #{row.number} {row.title} — attempts{" "}
                        {row.attemptDrift > 0 ? "+" : ""}
                        {row.attemptDrift}, accepted{" "}
                        {row.acceptedDrift > 0 ? "+" : ""}
                        {row.acceptedDrift}
                    </li>
                ))}
            </ul>
            {report.drifted.length > 10 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                    Showing the 10 largest of {report.drifted.length}.
                </p>
            ) : null}
        </div>
    )
}
```

Note the explicit "Showing the 10 largest of N" line: a silent truncation would read as complete coverage.

- [ ] **Step 2: Mount it**

In `ContentSection.tsx`, call `getCounterDriftReport()` alongside the other reads and render `<DriftIndicator report={report} />` above the per-problem table.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npm run build
npm run check:token-parity
```

- [ ] **Step 4: Commit and open the Phase 3 PR**

```bash
git add components/admin/analytics
git commit -m "feat(analytics): surface denormalized counter drift"
git push
gh pr create --base main --title "feat(analytics): V11 content performance" --body "<per template>"
```

---

## Phase 4 — Per-problem drill-down (PR 4)

### Task 13: Drill-down page and failure breakdown

**Files:**
- Create: `app/admin/analytics/problems/[slug]/page.tsx`
- Create: `components/admin/analytics/FailureBreakdown.tsx`
- Modify: `lib/analytics/analytics-read.ts` (add `getProblemDetail`)
- Modify: `components/admin/analytics/ContentSection.tsx` (point titles at the drill-down)

**Interfaces:**
- Consumes: `tallyFailures`, `FAILURE_CATEGORIES`, `FAILURE_LABELS` from `lib/analytics/failure-taxonomy.ts`.
- Produces: `getProblemDetail(slug: string): Promise<ProblemDetail | null>` where `ProblemDetail = { number: number; title: string; slug: string; attempts: number; accepted: number; distinctAttempters: number; firstTryAccepted: number; attemptsPerSolver: { attempts: number; solvers: number }[]; failureTally: Record<FailureCategory, number> }`.

- [ ] **Step 1: Add `getProblemDetail`**

Append to `lib/analytics/analytics-read.ts`:

```ts
import { tallyFailures, type FailureCategory } from "./failure-taxonomy"

export type ProblemDetail = {
    number: number
    title: string
    slug: string
    attempts: number
    accepted: number
    distinctAttempters: number
    firstTryAccepted: number
    /** How many solvers needed N attempts before their first acceptance. */
    attemptsPerSolver: { attempts: number; solvers: number }[]
    failureTally: Record<FailureCategory, number>
}

export async function getProblemDetail(
    slug: string
): Promise<ProblemDetail | null> {
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug },
        select: { id: true, number: true, title: true, slug: true },
    })
    if (!problem) return null

    // `code` is @db.Text and is deliberately not selected.
    const submissions = await prisma.submission.findMany({
        where: { problemId: problem.id },
        select: { userId: true, status: true, reason: true, createdAt: true },
        orderBy: { createdAt: "asc" },
    })

    const attemptsBeforeAccept = new Map<string, number>()
    const acceptedBy = new Set<string>()
    const attempters = new Set<string>()
    const firstAttemptAccepted = new Map<string, boolean>()

    for (const s of submissions) {
        attempters.add(s.userId)
        if (!firstAttemptAccepted.has(s.userId)) {
            firstAttemptAccepted.set(s.userId, s.status === "ACCEPTED")
        }
        if (acceptedBy.has(s.userId)) continue
        attemptsBeforeAccept.set(
            s.userId,
            (attemptsBeforeAccept.get(s.userId) ?? 0) + 1
        )
        if (s.status === "ACCEPTED") acceptedBy.add(s.userId)
    }

    const histogram = new Map<number, number>()
    for (const userId of acceptedBy) {
        const n = attemptsBeforeAccept.get(userId) ?? 1
        histogram.set(n, (histogram.get(n) ?? 0) + 1)
    }

    return {
        number: problem.number,
        title: problem.title,
        slug: problem.slug,
        attempts: submissions.length,
        accepted: submissions.filter((s) => s.status === "ACCEPTED").length,
        distinctAttempters: attempters.size,
        firstTryAccepted: [...firstAttemptAccepted.values()].filter(Boolean).length,
        attemptsPerSolver: [...histogram.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([attempts, solvers]) => ({ attempts, solvers })),
        failureTally: tallyFailures(
            submissions
                .filter((s) => s.status !== "ACCEPTED")
                .map((s) => s.reason)
        ),
    }
}
```

- [ ] **Step 2: Create `FailureBreakdown`**

Create `components/admin/analytics/FailureBreakdown.tsx`. It renders one row per category from `FAILURE_CATEGORIES`, using `FAILURE_LABELS` for copy.

Requirements:

- Every category is rendered, including zeros — a category omitted at zero would read as "never happens" rather than "none in this window".
- `PROBLEM_DEFECT` is visually distinguished (`text-destructive`) and labelled as an authoring bug, since it indicates the problem's expected output is malformed rather than a learner error.
- `OTHER` is always shown. A rising `OTHER` share means a validator message changed and the taxonomy needs updating; hiding it would mask that.
- If there are no failed submissions at all, render "No failed submissions recorded." rather than six zero rows.

- [ ] **Step 3: Create the drill-down page**

Create `app/admin/analytics/problems/[slug]/page.tsx`:

```tsx
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { getProblemDetail } from "@/lib/analytics/analytics-read"
import { Container } from "@/components/ui/Container"
import { FailureBreakdown } from "@/components/admin/analytics/FailureBreakdown"

export const metadata: Metadata = {
    title: "Problem analytics",
    robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

export default async function ProblemAnalyticsPage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    await requireAdminPage()
    const { slug } = await params

    const detail = await getProblemDetail(slug)
    if (!detail) notFound()

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <h1 className="text-2xl font-semibold">
                {detail.number}. {detail.title}
            </h1>
            <FailureBreakdown tally={detail.failureTally} />
            {/* attempt distribution and first-try acceptance render here */}
        </Container>
    )
}
```

Render the attempt distribution from `detail.attemptsPerSolver` as a labelled list ("solved on attempt 1: N learners"), and first-try acceptance as `firstTryAccepted` over `distinctAttempters` with the denominator visible. If `detail.attempts === 0`, render "No submissions for this problem yet." and omit both blocks rather than showing empty charts.

- [ ] **Step 4: Link the table to it**

In `ContentSection.tsx`, change the per-problem title link to `/admin/analytics/problems/<slug>`.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
npm run build
npm run check:token-parity
npm run check:ci-coverage
```

Expected: all exit 0.

- [ ] **Step 6: Commit and open the Phase 4 PR**

```bash
git add app/admin/analytics components/admin/analytics lib/analytics/analytics-read.ts
git commit -m "feat(analytics): per-problem drill-down with failure breakdown"
git push
gh pr create --base main --title "feat(analytics): V11 per-problem drill-down" --body "<per template>"
```

---

## Plan self-review

**Spec coverage.** Every spec section maps to a task: §1 day boundaries → Task 2; §2 snapshots → Tasks 1, 7; §3 indexes → Task 1; §4 counter drift → Tasks 6, 12; §5 failure taxonomy → Tasks 5, 13; §6 two activity series → Tasks 7, 9; §7 module structure → Tasks 2–7; §8 honesty constraints → Tasks 3, 4, 8, 9, 11, 12, 13; §9 access control → Tasks 9, 10; §10 cost and limits → Tasks 1, 2, 7; §11 phasing → the four phases; §12 testing → every task's wiring steps plus Task 10.

**One spec deviation, deliberate.** §7 says surface components reuse `MetricCard`. Task 8 introduces `StatTile` instead, because `MetricCard` requires an `href` several analytics figures do not have and its `DELTA_COLOR` would render rising failure counts green — both flagged in the spec's own §7 constraints as needing resolution. The spec's requirement that this be resolved rather than discovered is satisfied; the resolution is a sibling component, not a modification of `MetricCard`, so the admin Overview is untouched.

**Correction made during review.** An earlier draft defined learn activity as a per-day series over `LessonProgress.updatedAt`, and Task 1 indexed only `completedAt` — so the query had no index behind it. Fixing the index alone would have made a wrong number fast: `updatedAt` is `@updatedAt` on a table with one mutable row per `(userId, articleId)` and no `createdAt`, so it records only each row's most recent touch, and a daily series over it undercounts every day except today. Learn activity is now a completions series from the write-once `completedAt` plus a trailing-window total from `updatedAt`, and both indexes are added. Practice and learn are therefore deliberately asymmetrical in shape — that asymmetry reflects the columns and must not be "tidied up" into two matching series.

**Known gap carried into implementation.** `lib/analytics/analytics-read.ts` has no unit suite. It is a query layer with no branching logic by design — everything with a testable branch lives in the pure modules. Its risk is query shape, covered by Task 10's e2e and by `tsc`. If an implementer adds a branch to that file, it belongs in a pure module instead.

**Type consistency.** `DayBucket` originates in `lib/profile-stats.ts` and is re-exported by `metric-windows.ts`; `MetricDelta`/`DeltaDirection` come from `lib/admin/metric-delta.ts`; `DriftReport` from `counter-drift.ts` is consumed unchanged by Task 12; `FailureCategory` from `failure-taxonomy.ts` is consumed unchanged by Tasks 7 and 13. `getProblemPerformance` returns `distinctAttempters`, which Task 11 uses as the first-try denominator.
