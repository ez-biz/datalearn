# Contest Standings — design

**Status:** approved 2026-06-14
**Author:** Anchit (with Claude)
**Related:** [`2026-05-24-contests-design.md`](./2026-05-24-contests-design.md), `docs/ROADMAP.md` (contests Phase 3)

## Problem

Contests Phase 1 (foundation) and Phase 2 (server-side judge) shipped to `main`.
The backend computes and persists per-participant scores on every accepted
submission (`ContestLeaderboardEntry`, `ContestProblemSolve`), but there is **no
UI to view standings**. A learner can register, solve, and submit during a live
contest, yet has no way to see their rank or how they compare to others — the
emotional payoff of a contest is missing. This gap blocks exposing contests to
the public.

This spec covers the **minimal, complete standings view** needed to make the
contest experience whole. It deliberately defers the richer Phase 3+ items
(per-problem grid, rating, live push refresh).

## Goals

- Show a read-only standings table on the existing contest page.
- Render correct ranks ordered by ICPC tie-break: points desc, then penalty asc.
- Highlight the signed-in participant's own row.
- Ship with no schema changes (all data already exists) and no new routes.

## Non-goals (explicitly Phase 3+)

- Live auto-refreshing standings (this view is fresh-on-load, not pushed).
- Per-problem ICPC grid (per-problem solve times / attempt counts as columns).
- Rating / Glicko-2 display (`ratingBefore/After/Delta` columns stay unused).
- Pagination (contests are small at launch; revisit if a board exceeds a few
  hundred rows).
- Avatars (name-only identity by product decision).

## Data model (existing — no migration)

`ContestLeaderboardEntry` (composite PK `(contestId, userId)`):
`rank`, `points`, `penaltySeconds`, `solvedCount`, rating fields (unused here),
`@@index([contestId, points, penaltySeconds])`.

**Important:** the persisted `rank` column is **not maintained** — the upsert in
`lib/contest-submit.ts` always writes `rank: 0`. The UI therefore **ignores the
stored `rank`** and computes display rank from sort order at query time. The
`@@index([contestId, points, penaltySeconds])` exists precisely to support this
query-time sort.

## Architecture

Three small, independently testable units:

### 1. Data — `getContestLeaderboard(contestId)` in `actions/contests.ts`

- Queries `contestLeaderboardEntry`:
  - `where: { contestId }`
  - `orderBy: [{ points: "desc" }, { penaltySeconds: "asc" }, { userId: "asc" }]`
    (the trailing `userId` makes ties deterministic and stable)
  - `include: { user: { select: { id: true, name: true } } }` — **never selects
    `email`.**
- Returns `LeaderboardRow[]` via a **pure mapper** (see unit below):
  `{ rank, userId, participant, solvedCount, points, penaltySeconds }`, where
  `rank` is the 1-based array position and `participant = user.name ?? "Anonymous"`.

### 2. Pure helpers — `lib/contests/leaderboard.ts`

Kept pure (no Prisma, no React) so they unit-test without a DB:

- `toStandingsRows(entries)` — maps ordered raw entries to `LeaderboardRow[]`,
  assigning `rank` by index (1-based). Assumes input is already ordered by the
  query; does not re-sort (single source of truth for ordering is the DB query).
- `formatPenalty(seconds: number): string` — `H:MM:SS` (e.g. `750 → "0:12:30"`,
  `3661 → "1:01:01"`). Minutes and seconds zero-padded to 2 digits; hours not
  padded.

### 3. Presentation — `components/contests/ContestStandings.tsx`

Presentational server component (no client state). Props:
`{ rows: LeaderboardRow[]; viewerUserId: string | null; status: "LIVE" | "CLOSED" }`.

- Renders a `Card` containing a table with columns:
  **Rank · Participant · Solved · Points · Penalty**.
- Numeric columns use `tabular-nums`.
- The row whose `userId === viewerUserId` is highlighted (subtle `bg`), and its
  participant cell shows **"You"** instead of the name.
- Empty state (no rows):
  - `LIVE` → "No submissions yet — be the first to solve a problem."
  - `CLOSED` → "No one solved a problem in this contest."

### 4. Integration — `app/contests/[slug]/page.tsx`

- Compute `viewerUserId = session?.user?.id ?? null`.
- Only when `status === "LIVE" || status === "CLOSED"`, fetch the leaderboard in
  the existing `Promise.all` alongside the registration lookup, then render
  `<ContestStandings>` in the left column **below the Problems section**.
- During `SCHEDULED`, render nothing for standings (no submissions exist and
  problems are already hidden).
- The page is already dynamic (uses `auth()` + Prisma), so standings reflect the
  current DB on every load.

## Data flow

```
contest page (server)
  ├─ getContestBySlug(slug)              → status, problems, meta (existing)
  └─ if LIVE|CLOSED:
       getContestLeaderboard(contest.id) → ordered ContestLeaderboardEntry rows
         └─ toStandingsRows()            → LeaderboardRow[] (rank by position)
              └─ <ContestStandings rows viewerUserId status />
                   └─ formatPenalty() per row
```

## Error handling

- `getContestLeaderboard` returns `[]` on any query error (consistent with the
  other read actions' defensive style); the component then shows the empty state
  rather than throwing. A failed standings fetch never breaks the contest page.

## Testing

- **Unit** (`scripts/test-contest-leaderboard.ts`, tsx + `node:assert`, matching
  the repo's existing script-test pattern; wire a `test:contest-leaderboard` npm
  script):
  - `formatPenalty`: `0 → "0:00:00"`, `750 → "0:12:30"`, `3661 → "1:01:01"`.
  - `toStandingsRows`: assigns ranks 1..n by position; maps null `name` to
    "Anonymous"; preserves the input order (does not re-sort).
- **E2E** (extend `tests/e2e/contests-foundation.spec.ts` or a focused new spec):
  seed a `LIVE` contest with two `ContestLeaderboardEntry` rows (distinct
  points), load `/contests/<slug>` as one of the participants, and assert: the
  Standings table renders, row order matches points-desc, penalty is formatted,
  and the viewer's row shows "You". Use the relative-date / future-vs-now
  patterns already established in that spec; for a LIVE contest set
  `startsAt` in the past and `endsAt` in the future.

## Release linkage

Once this ships and merges to `main`, the contests feature is complete enough to
expose publicly, unblocking the `main → production` release that also carries the
perf/dependency-security fixes (#154) and e2e stabilization (#156).
