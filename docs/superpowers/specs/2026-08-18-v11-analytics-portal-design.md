# V11 — Internal Analytics Portal (design)

**Status:** approved, ready for planning
**Date:** 2026-08-18
**Roadmap item:** V11 (`docs/ROADMAP.md`), Q3 2026 goal "user analytics + content moderation"
**Baseline:** `main` @ `aa54a3a` (v0.11.0)

## Why

The roadmap states it plainly: *"We're flying blind today — there's no view of 'which problem has the worst acceptance rate' or 'what fraction of users return weekly'. Without analytics, every product decision is a guess."*

The platform now has a published curriculum, 77 problems and real users. The next roadmap items are large (V5 Python is scoped "Large"), and choosing between them without knowing whether learners finish a track is guessing. This portal exists so that decision is informed.

Audience is **operators, not learners** — distinct from `/profile`, which reports a single user's own stats.

## Scope decisions

**The "content moderation" half of the Q3 goal is already shipped** and is not in scope here. Discussions are wired across 57 files: learner-facing comment/vote/report APIs under `app/api/problems/[slug]/discussion/`, an admin queue at `/admin/discussions` with hide / restore / mark-spam / dismiss-reports, plus `ModeratorPermission`, `DiscussionModerationLog` and `UserReputationEvent`. This spec covers the analytics half only.

**V11's "health" component group is dropped.** It asks for error rates and P95 latencies "from existing Vercel Analytics integration if we expose them server-side". Those live in Vercel's dashboard, not in a queryable table. Per the project's fallback rule — *a block that would render empty must show an honest alternative or not render* — the section is omitted rather than stubbed.

**No new tracking is introduced.** Three of V11's listed components are not derivable from existing data and are explicitly out of scope:

| V11 component | Why it is out of scope |
| --- | --- |
| Per-article views, time-on-page | No first-party event tracking exists anywhere in the codebase. `@vercel/analytics` is mounted in `app/layout.tsx` but its data is not server-queryable. |
| Click-through from article to problem | Same — requires a click event that is not recorded. |
| Abandonment ("started but never submitted") | "Started" has no server-side signal, and the closest one is foreclosed: the privacy policy promises that queries you only **Run** "execute entirely in your browser via WebAssembly. They never leave your device." |

Adding an events table remains a legitimate phase 2, but it needs a privacy-policy amendment and is deliberately not bundled here.

## What existing data proves

Derivable today, with no schema change beyond indexes:

- **Sign-ups per day** — `User.createdAt`
- **Active users per day** — distinct `Submission.userId`; separately, distinct `LessonProgress.userId`
- **Submissions per day, and acceptance rate** — `Submission.createdAt`, `Submission.status`
- **Per-problem attempts, distinct solvers, acceptance rate** — `Submission` grouped by `problemId`
- **First-try acceptance per problem** — each user's earliest submission per problem
- **Failure-category breakdown** — classified from `Submission.reason` (see §5)
- **Retention cohorts D1 / D7 / D30** — `User.createdAt` × activity dates
- **Funnel: sign-up → first submission → first acceptance** — same two tables
- **Lesson and track completion** — `LessonProgress.completedAt`, `percent`

## 1. Day boundaries

All bucketing reuses **`toDayKey` from `lib/profile-stats.ts`**, which produces `YYYY-MM-DD` in **UTC**. Its comment records why: *"doing it in UTC avoids timezone wobble when the same submission could otherwise land on different days for users in different zones."*

This is not a detail. `/profile`'s heatmap and the home streak already bucket this way. Analytics defining its own day boundary would make the same submission land on different days on different screens — the cross-screen contradiction class this project has hit four times. Reusing the function makes agreement structural rather than coincidental.

**Requirement:** no new day-bucketing implementation. `lib/analytics/metric-windows.ts` imports `toDayKey` and builds ranges from it.

## 2. Snapshots: only what cannot be recomputed

A snapshot table plus a live query computing the same number two ways is precisely the bug that produced "5 of 39" against "4 / 39" in SP6. The split is therefore by **recomputability**, not convenience.

**Never snapshotted — always computed live, for any date range.** Everything derived from immutable timestamped rows: sign-ups, submissions, acceptance, active users, lesson completions, retention, funnel. A past day recomputes identically forever, so a stored copy is a redundant second source that can only drift.

**Snapshotted daily — mutable state with no history:**

| Field | Why it cannot be recomputed |
| --- | --- |
| `publishedProblems` | `SQLProblem` keeps no status-change log; today's `PUBLISHED` set says nothing about last month's. |
| `publishedArticles`, `publishedTracks` | Same. |
| `lessonsInProgress` | `LessonProgress.percent` is overwritten in place; only `completedAt` is durable. |
| `registeredUsers` | Account deletion cascades rows away, rewriting history retroactively. |

```prisma
model MetricSnapshot {
  day               String   @id  // YYYY-MM-DD, UTC, from toDayKey
  registeredUsers   Int
  publishedProblems Int
  publishedArticles Int
  publishedTracks   Int
  lessonsInProgress Int
  createdAt         DateTime @default(now())
}
```

`day` as the primary key makes the daily write an upsert and therefore idempotent — a re-run or a retried cron cannot double-count.

**Rule for implementers:** a metric belongs in `MetricSnapshot` only if it cannot be recomputed from immutable rows. Adding a recomputable metric to this table is a defect, not an optimisation.

## 3. Indexes

Every `Submission` index today is `userId`-leading — `[userId, problemId, createdAt]`, `[userId, createdAt]`, `[userId, status]`. They were built for `/profile`. Analytics queries are the opposite shape: range over `createdAt` across all users, or group by `problemId`. Nothing serves them, so v1 would sequential-scan the operational database.

Add:

- `Submission @@index([createdAt])` — daily series and active-user counts
- `Submission @@index([problemId, status])` — per-problem acceptance
- `User @@index([createdAt])` — sign-up series and cohorts
- `LessonProgress @@index([completedAt])` — completions series (the existing `[userId, completedAt]` is `userId`-leading and cannot serve a global range)

One migration, additive, no data change.

**Query hygiene:** `Submission.code` is `@db.Text` and can be large. No analytics query may select it. Every read uses an explicit `select`.

## 4. Counter drift becomes a monitored signal

`SQLProblem.attemptCount` / `acceptedCount` are denormalized, incremented in the same transaction that writes a `Submission` (`actions/submissions.ts:130-135`). The schema comment already documents the flaw:

> *These drift: deleting a User cascades their Submissions away and nothing decrements the counters. Repair with `npm run verify:pass-rate -- --fix`.*

`/practice` renders pass rates from those counters, because rendering the whole catalog needs O(1) per row. Analytics computes acceptance from `Submission` rows, which is the truth. **The two will disagree by design.**

Reading the counters instead would guarantee agreement while reporting numbers known to be wrong — unacceptable for an operator tool whose entire purpose is to report reality. So:

- Analytics computes from `Submission` rows.
- The Content section shows a **drift indicator**: how many problems have `attemptCount` ≠ true attempts or `acceptedCount` ≠ true accepted, and by how much.
- When drift is non-zero, the copy names the repair: `npm run verify:pass-rate -- --fix`.
- When drift is zero, the indicator states the counters are in sync rather than rendering nothing — silence is indistinguishable from "not checked".

This converts a documented silent debt into a monitored one. `lib/analytics/counter-drift.ts` holds the comparison as a pure function.

## 5. Failure taxonomy

`Submission.reason` is free text with runtime values interpolated by `lib/sql-validator.ts`:

- `Row count mismatch — got 3, expected 5.`
- `Column mismatch — got [a,b], expected [x,y].`
- `Row 4 differs from expected.`
- `Your result is not an array of rows.`
- `Expected output is malformed. Report this problem.`

`GROUP BY reason` is therefore useless — the interpolated numbers make nearly every row unique.

`lib/analytics/failure-taxonomy.ts` classifies the text into a small stable set at read time:

```ts
type FailureCategory =
    | "ROW_COUNT"        // wrong number of rows
    | "COLUMN_MISMATCH"  // wrong columns or column names
    | "ROW_CONTENT"      // right shape, wrong values
    | "MALFORMED_RESULT" // not an array of rows
    | "PROBLEM_DEFECT"   // expected output malformed — an authoring bug
    | "OTHER"            // unrecognised; never silently dropped
```

Read-time classification is chosen over a new `reasonCode` column deliberately: it works retroactively across every existing submission, where a new column could only describe rows written after the migration.

`PROBLEM_DEFECT` is called out separately because it indicates a broken *problem*, not a struggling learner — exactly the kind of thing this portal should surface.

**Test contract:** the classifier's unit test feeds genuinely mismatched data through the real `lib/sql-validator.ts` and asserts each produced message classifies correctly. Editing a validator message then breaks the test rather than silently degrading classification into `OTHER`. A test that asserts against hand-copied message strings does not satisfy this and would be a review defect.

## 6. Activity is two series, never blended

A learner can read an entire track without submitting once. Counting only submissions would render that engagement as zero — undercounting exactly what the curriculum work shipped.

The portal therefore reports **practice activity** (distinct users with a `Submission`) and **learn activity** (distinct users with `LessonProgress` movement) as two distinct series, and never sums them into a single "active users" headline. Where a combined figure is genuinely wanted, it is labelled as a union of distinct users and computed as one query, not by adding the two series — adding them would double-count anyone who did both.

## 7. Module structure

Pure, Prisma-free, DOM-free — unit-testable with no database, following the established pattern.

| File | Responsibility |
| --- | --- |
| `lib/analytics/metric-windows.ts` | Day ranges from `toDayKey`; period-over-period window pairing |
| `lib/analytics/retention.ts` | Cohort bucketing; D1/D7/D30; insufficient-history detection |
| `lib/analytics/funnel.ts` | Funnel step counts and conversion rates |
| `lib/analytics/failure-taxonomy.ts` | Free-text reason → `FailureCategory` |
| `lib/analytics/counter-drift.ts` | Denormalized counters vs true counts |
| `lib/analytics/analytics-read.ts` | Prisma aggregate reads. **Not** a `"use server"` file. |

**Reused, not duplicated:** `lib/admin/metric-delta.ts` (`computeDelta(current, previous | null): MetricDelta | null`, already returns `null` where a delta would be dishonest) and `toDayKey` from `lib/profile-stats.ts`.

Surface components reuse `components/admin/AdminListShell.tsx`, and the page renders inside SP7's admin console shell as a normal shell route — no new shell mode, so `isFocusRoute` / `isAppRoute` mutual exclusivity is untouched.

**`MetricCard` reuse carries two constraints**, both of which must be resolved in Phase 2 rather than discovered during implementation:

1. It renders as a `<Link>` and requires `metric.href`. Several analytics figures (retention, WAU) have no meaningful destination. Either give every card a real destination or add an explicit non-linking variant — do not invent a placeholder href.
2. Its `DELTA_COLOR` map is fixed: `up → text-easy` (green), `down → text-destructive` (red). That mapping is correct for sign-ups and acceptance rate, and **wrong** for any metric where rising is bad — a climbing failure-category count or drift count would render green. Analytics must either restrict `MetricCard` to metrics where the mapping holds, or extend it with an explicit polarity prop. Rendering "failures up 40%" in green is a correctness defect, not a styling nit.

Its `AdminMetric` type is exported from `actions/admin-dashboard.ts`. Components may import it; `lib/analytics/` must not, since no `lib/` file may import from `actions/`.

## 8. Honesty constraints

These are requirements, not preferences. Each one is a case where the easy implementation lies.

1. **Deltas only where real.** `computeDelta` returns `null` when the previous period is unknown; the card then renders no delta line — not a zero, not a dash.
2. **Retention with no complete cohort renders "not enough history yet"**, never 0%. A platform 10 days old has no D30 cohort; showing 0% would read as total churn.
3. **Rates over tiny denominators show the denominator.** "100% acceptance (1 of 1)" is honest; a bare "100%" is not.
4. **Never blend practice and learn activity** (§6).
5. **Zero states are stated, not blank** — "no submissions in this window" rather than an empty chart.
6. **`OTHER` failures are shown, never dropped**, so a validator message change is visible as a rising unclassified share.

## 9. Access control

`/admin/analytics` is ADMIN-only. `MODERATOR` does not gain access: moderator permissions today are scoped to the discussion queue (`VIEW_DISCUSSION_QUEUE`), and platform-wide user metrics are a different trust level. The nav entry is filtered server-side by the existing `visibleAdminNav` mechanism, which is fail-closed for unknown roles.

The snapshot cron route is gated by `CRON_SECRET`, matching `app/api/cron/asset-gc/route.ts`.

## 10. Cost and limits

Reads are admin-only, so concurrency is one or two users. With the §3 indexes, the daily-series and per-problem-group queries are index scans over bounded ranges.

**Bounded windows:** the maximum queryable range is 365 days, matching the heatmap window. Unbounded ranges are rejected rather than silently truncated.

Vercel Hobby permits 100 cron jobs per project at a minimum interval of once per day with ±59 min precision — verified against Vercel's cron limits documentation. A third daily cron is within limits, and daily is the intended cadence. The ±59 min jitter is harmless because the snapshot upserts by UTC day key and writes the *previous* complete day.

## 11. Phasing

Four PRs, each against `main`.

**Phase 1 — foundation.** Indexes migration, `MetricSnapshot`, the snapshot cron, all five pure modules, and `analytics-read.ts`. Verified by unit suites plus a cron invocation writing an idempotent row. **No UI** — this phase is verifiable but not visible.

**Phase 2 — platform section.** `/admin/analytics` with sign-ups, the two activity series, submissions per day, acceptance rate, retention cohorts, and the funnel.

**Phase 3 — content performance.** Per-problem table (attempts, distinct solvers, acceptance rate, first-try acceptance), per-track completion, and the counter-drift indicator.

**Phase 4 — per-problem drill-down.** Attempt distribution, first-try acceptance, and the failure-category breakdown for a single problem.

## 12. Testing

Every new pure module gets a `node --import tsx --test` suite, **wired into `.github/workflows/test.yml` in the same PR** — now additionally enforced by `npm run check:ci-coverage`, which fails on an unwired script.

Required cases beyond the happy path:

- `metric-windows`: a range crossing a month boundary; a single-day range; UTC agreement with `toDayKey` on a timestamp near midnight.
- `retention`: a cohort too young for its window returns insufficient-history, distinct from a cohort with genuine 0% retention. These two must not be conflated — that distinction is the point.
- `funnel`: a user who signs up and never submits; a user whose first submission is accepted (both funnel steps on one row).
- `failure-taxonomy`: driven through the real validator per §5, plus an unrecognised string landing in `OTHER`.
- `counter-drift`: counters ahead of truth (the documented deletion case), counters equal, and a problem with zero submissions.

E2E covers admin-only access (a non-admin is refused) and that the page renders with an empty database — the zero-data path, which is the state the CI database is actually in and the shape that caused the v0.9.1 hotfix.

Tests must not mutate ambient rows: fixtures are prefix-scoped and cleaned up, per the convention established in SP6/SP7.

## Open questions

None. Decisions taken during brainstorming: derivable-only (no new tracking); indexes plus snapshots, with snapshots restricted to non-recomputable state; activity tracked as two separate series; scope covering platform, content and per-problem drill-down.
