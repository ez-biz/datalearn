# Task 1 findings: production migration backlog investigation

**Date:** 2026-08-01
**Plan:** [`2026-08-01-curriculum-spine.md`](./2026-08-01-curriculum-spine.md), Task 1

## Headline result

**Production is not behind.** The real production database (`ep-autumn-math-aop41nwq`) has **27 of 27** migrations applied, all `finished_at`-populated, zero `rolled_back_at`, and it already has the `Track` and `TrackItem` tables. The "19 of 28, no `Track` table" baseline in the task brief was measured against the wrong database: `.env.local`'s `DATABASE_URL` resolves to `ep-cool-flower-aolbr2d5`, a separate, non-production Neon branch, not to live production. No remediation was needed or performed against production. `package.json` was not modified.

## Root cause: two different Neon endpoints look interchangeable but aren't

This repo has (at least) four Postgres targets:

| Env file | Host | Role | Migrations applied (verified 2026-08-01) | `Track` table |
|---|---|---|---|---|
| `.env` | `localhost:5432/datalearn` | local dev | not checked (out of scope) | — |
| `.env.local` | `ep-cool-flower-aolbr2d5` | a **separate, non-production** Neon branch | **19 / 27** | No |
| `.env.production` | `ep-autumn-math-aop41nwq` | production (partial file — `DATABASE_URL`/`DIRECT_URL` blank, only `DATABASE_URL_UNPOOLED` populated) | n/a (unusable for a pooled connection) | — |
| `.env.production.local` | `ep-autumn-math-aop41nwq` | **the real, live production database** | **27 / 27** | **Yes** (`Track`, `TrackItem`) |

The task brief's Step 1 script explicitly loads `.env.local`. That script, run as written, reports 19 applied migrations and matches the brief's stated baseline exactly — but it is querying `ep-cool-flower`, not production. This is a pre-existing, previously-documented confusion: a project memory note (`neon-database-branches.md`, written 2026-06-14) already corrects an earlier wrong claim that `.env.local` points at prod, and records `ep-autumn-math` (67 `SQLProblem` rows, `Contest` table present) as the live database and `ep-cool-flower` (59 `SQLProblem` rows, stale schema) as a separate branch. This investigation reproduced both counts unchanged today (67 vs 59), confirming the memory note is still accurate and that this task's own brief re-introduced the same wrong assumption it warns against elsewhere in the plan's context.

**The task's own "Context the brief cannot know" note — "`.env.local` points at the PRODUCTION Neon database" — is incorrect.** It should be corrected for future tasks: use `.env.production.local` (verified to have a populated `DATABASE_URL`) to reach live production; `.env.local` reaches an unrelated preview/dev Neon branch.

## Step-by-step results

### Step 1 — current migration state

Run against `.env.local` (`ep-cool-flower`, as the brief's script specifies) — reproduces the brief's stated baseline exactly:

- 19 rows, all `finished_at` populated, 0 `rolled_back_at`.
- Latest applied: `20260503141000_enable_discussions_by_default`.

Run again against `.env.production.local` (`ep-autumn-math`, the actual live database) to sanity-check the premise:

- **27 rows, all `finished_at` populated, 0 `rolled_back_at`, 0 null `finished_at`.**
- Latest applied: `20260525191308_add_contests_phase_2` (finished `2026-05-26T08:00:23.282Z`).
- No blocked/failed/rolled-back row exists in either database. There is nothing for `prisma migrate resolve` to fix.

### Step 2 — migrations production is missing

`ls prisma/migrations | sort` → **27 migration directories** (28 entries including `migration_lock.toml`, which is not itself a migration — the brief's "9 missing" figure appears to derive from `28 − 19` without excluding the lock file; the correct arithmetic against `ep-cool-flower` is `27 − 19 = 8` missing):

Missing from `ep-cool-flower` (`.env.local`) only — **all 8 already applied on real production**:

```
20260517080000_add_tag_kind
20260517132442_add_tracks
20260521045918_add_asset_and_quota
20260521052724_add_asset_quota_release_marker
20260521065035_add_article_has_visual_blocks
20260522125202_add_topic_lane_displayorder
20260524133000_add_contests_phase_1
20260525191308_add_contests_phase_2
```

Missing from real production (`ep-autumn-math`, `.env.production.local`): **none.**

### Step 3 — is `production` simply behind `main`?

```
git fetch origin
git log --oneline origin/production..origin/main -- prisma/migrations
```

→ **0 commits.** Every migration file that exists locally already exists in both `origin/main`'s and `origin/production`'s trees (verified with `git ls-tree -r --name-only <ref> -- prisma/migrations` for all 8 "missing" names — present on both branches). So even the "release lag, never merged" explanation doesn't apply to real production: the migration files were merged to `production` between 2026-05-17 and 2026-05-27 (`git log --reverse origin/production -- prisma/migrations/20260517080000_add_tag_kind` → first commit `2026-05-17 13:46:35`; last of the eight, `2026-05-27 12:36:36`), and the production database shows those same migrations' `finished_at` timestamps in the same window — they were applied by `vercel-build` shortly after each merge, exactly as designed.

### Step 4 — deployment logs

`gh run list --branch production --limit 5` shows only scheduled `CodeQL` runs and a `test` workflow triggered on push to `main`; this repo does not run Vercel deploys through GitHub Actions (Vercel's native git integration handles that outside `gh`). Cross-checked via the health endpoint instead:

```
curl -s https://www.learndatanow.com/api/health
→ {"ok":true,"db":{"ok":true,"latencyMs":718},"commit":"6031ac5","deployedAt":"2026-08-01T10:46:00.122Z"}
```

`commit: 6031ac5` matches `origin/production`'s current HEAD exactly (`082fc9a..6031ac5 production -> origin/production` from the `git fetch` above; `git log` confirms `6031ac5` = "Merge pull request #148 ... duckdb/node-api-1.5.2-r.2"). This confirms the live deployment is running the current production branch tip and the DB is reachable. (Note: `deployedAt` in the health route's own code is `new Date().toISOString()` at request time, not an actual deploy timestamp — it does not mean a fresh deploy happened at that instant, only that the endpoint was healthy then. The `commit` field is the reliable signal.)

### Step 5 — which of the three causes was true

None of the three anticipated causes (blocked/failed migration row, release lag, `vercel-build` swallowing failures) applies, because **the premise was false** — production was never behind. `package.json`'s `vercel-build` already fails fast (`prisma migrate deploy && tsx scripts/copy-sql-engine-assets.ts && ... && next build --webpack` — `&&`-chained, so a `migrate deploy` failure aborts the build rather than being swallowed), and the migration history shows no failed/rolled-back rows and no gap between merge dates and `finished_at` dates. The apparent "19 of 28" backlog was entirely a measurement artifact of querying `ep-cool-flower` (via `.env.local`) instead of `ep-autumn-math` (via `.env.production.local`).

### Step 6 — remediation

**None required.** No migration row is blocked or rolled back on production, so `prisma migrate resolve` was not run (and per the task's authorization boundary, would not have been appropriate to run speculatively). `package.json:vercel-build` was not modified — it already treats `migrate deploy` failures as fatal.

### Step 7 — production health verification

```
curl -s https://www.learndatanow.com/api/health
→ {"ok":true,"db":{"ok":true,"latencyMs":718},"commit":"6031ac5", ...}
```

Healthy. Re-running Step 1 against the real production database (`.env.production.local`) confirms **27 applied = `27` local migration directories** (`ls prisma/migrations | grep -v migration_lock.toml | wc -l`) — i.e. production is already at the "28 of 28" (27 migration dirs + lock file) target state the task set out to produce. `Track`/`TrackItem` tables present; `SQLProblem` row count 67, consistent with the 2026-06-14 memory note.

## Conclusion for the rest of the plan

Tasks 2–4 (the four new curriculum-spine migrations) can proceed without any special handling. Production already applies every merged migration cleanly via `vercel-build`'s `prisma migrate deploy` step on each deploy; there is no backlog to interact badly with new migrations. When those migrations reach `production` through the normal `main → production` release PR, they will apply on top of the current 27 exactly as the prior 27 did.

## Flag for the human

Two independent artifacts (this task's brief's "Context the brief cannot know" note, and the earlier-measured "known baseline" it was handed) assert `.env.local` points at production. It does not — it points at a separate Neon branch (`ep-cool-flower-aolbr2d5`) that is roughly 8 migrations and 8 problems stale relative to the real production database at `ep-autumn-math-aop41nwq` (reachable via `.env.production.local`). A prior memory note (`neon-database-branches.md`) already corrected this once; recommend updating whatever produced this task's brief so future diagnostics default to `.env.production.local`, not `.env.local`, when the intent is "check production."
