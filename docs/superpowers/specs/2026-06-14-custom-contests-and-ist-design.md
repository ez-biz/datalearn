# Custom Contests + IST Time Standard — design

**Status:** approved 2026-06-14
**Author:** Anchit (with Claude)
**Related:** [`2026-05-24-contests-design.md`](./2026-05-24-contests-design.md), [`2026-06-14-contest-play-design.md`](./2026-06-14-contest-play-design.md), `docs/ROADMAP.md` (V2 — Contest)
**Depends on:** the contest play work (#161 / branch `feat/contest-play`) — this branch is stacked on it.

## Part A — IST time standard

All contest times standardize on **IST (Asia/Kolkata)**, a fixed +05:30 offset, for both display and input. This replaces the viewer-local `LocalTime` component added in #161 (which showed each viewer their own timezone) and fixes the original server-timezone bug.

- **Display:** a pure `formatIST(value)` renders a stored UTC timestamp as e.g. `"Jun 18, 2026, 6:00 PM IST"` via `Intl`/`toLocaleString("en-IN", { timeZone: "Asia/Kolkata", ... })`. Because the zone is fixed, this is **deterministic on server and client**, so it runs in server components (no `"use client"`, no hydration dance). The `LocalTime` client component is removed and its call sites switch to `formatIST`.
- **Input:** a pure `istLocalInputToUtc(localInput)` interprets a `datetime-local` string `"YYYY-MM-DDTHH:mm"` as IST wall-clock and returns the UTC `Date`. Contest creation forms (the new custom form **and** the existing admin `ContestForm`) use it and label the fields "(IST)", so a creator typing "6:00 PM" always means 6:00 PM IST regardless of their browser timezone.
- **Countdown:** unchanged — it counts absolute remaining milliseconds, timezone-agnostic.

Helpers live in `lib/time-ist.ts` (pure, unit-tested).

## Part B — Custom contests

Signed-in users create their own unlisted, link-shared contests judged practice-style. Reuses the existing `Contest` model — **no schema migration**.

### Decisions (locked)
- **Unlisted, link-shared:** not in the public `/contests` list; the unguessable random slug *is* the share secret.
- **Practice-style judging:** the browser runs the SQL (DuckDB/PGlite) and submits the **result rows**; the server validates them against the problem's **public** `expectedOutputs[dialect]` (the existing `lib/sql-validator.ts` comparator) and records the result for the leaderboard. **No server-side SQL execution from user contests** — a deliberately small abuse surface. *Known limitation:* this trusts the client's submitted rows, so custom contests are **not cheat-proof** like official (hidden-data) ones. Acceptable for casual, unlisted, **unrated** contests; surfaced in the UI ("friendly / unrated") and here.
- **Cap: 1 active per user** — a user may have at most one non-`CLOSED` `USER_CUSTOM` contest at a time. Ended ones don't count, so they can run more over time.
- **Join by link:** any signed-in user who opens the link can compete; no registration step (matches the existing `USER_CUSTOM` no-registration behavior in `lib/contest-submit.ts` and `lib/contest-registration.ts`).
- **Always unrated**, problems are **not locked** out of public practice.

### Architecture

**Pure helpers — `lib/contests/custom.ts`** (no Prisma/React, unit-tested):
- `generateContestSlug(): string` — unguessable (e.g. 16 url-safe chars). *(Randomness comes from `crypto`, injected/awaited in the action, not in the pure module — keep the module deterministic by accepting bytes; or expose `slugFromBytes(bytes)` pure + the action supplies `crypto.getRandomValues`.)*
- `validateCustomContestInput(input)` → ok/error: ≥1 problem, ≤20 problems, title 3–80 chars, duration 10 min–7 days, `maxParticipants` 1–50.
- `canCreate(activeCount)` → `activeCount < 1`.

**Actions — `actions/custom-contests.ts`** (`"use server"`):
- `createCustomContest(input)`: requires a session; counts the user's active (`status` derived ≠ CLOSED) `USER_CUSTOM` contests and rejects if ≥1; validates input (incl. IST-parsed times); creates the `Contest` (`kind: "USER_CUSTOM"`, random slug, `rated: false`, `visibility: "PUBLIC"`, `createdById`), attaches the chosen problems (`points` default 1 each). Returns `{ slug }`.
- `getCustomContestBySlug(slug)`: returns the contest **only if** `kind === "USER_CUSTOM"`; problems hidden until status is LIVE/CLOSED (same `deriveContestStatus`); includes the viewer's registration-free standings data. Used by the detail + play pages.
- `submitCustomContestEntry({ slug, problemId, dialect, userResult })`: requires a session; verifies `USER_CUSTOM` + status LIVE + problem attached; **validates `userResult` against the problem's public `expectedOutputs[dialect]`** via the shared comparator; records a `ContestSubmission` (verdict `ACCEPTED`/`WRONG_ANSWER`) and, on first accept, a `ContestProblemSolve` + leaderboard update by **reusing `recordFirstSolveAndLeaderboard`** from `lib/contest-submit.ts`. Returns `{ verdict, attemptNumber }`.

**UI:**
- **Create:** `/contests/custom/new` — a signed-in form: title, problem multi-select (search the published catalog), start/end (IST-labelled), max participants. On success, redirect to the contest with a copy-the-link affordance. A "Create your own contest" entry point is added to the `/contests` page header.
- **Detail:** `/contests/custom/[slug]` — title, status pill, the share link (copy button), times in IST, problems (hidden until live, each linking to its play page), and the standings (reuse `ContestStandings`). A "1 active contest" notice + cap messaging on the create entry when the user already has one.
- **Play:** `/contests/custom/[slug]/[problemSlug]` — reuses `ContestPlayClient` with a new `judge: "PRACTICE"` mode: Submit runs the query in-browser (already wired) and sends the **result rows** to `submitCustomContestEntry` (instead of POSTing raw SQL to the official judge). Verdict panel, countdown, and A/B/C switcher are reused unchanged.

### Data flow (play, practice-style)

```
/contests/custom/[slug]/[problemSlug] (server: gating, IST times)
  └─ ContestPlayClient (judge: "PRACTICE")
       Submit → runQuery(sql) in browser  → result rows
              → submitCustomContestEntry({slug, problemId, dialect, rows})
                   → validate rows vs public expectedOutputs[dialect]  (sql-validator)
                   → record ContestSubmission + first-solve + leaderboard
                   → { verdict, attemptNumber } → verdict panel
```

### Security / abuse posture (matters for the wider launch)
- Unlisted (no public spam surface); unrated; **1-active cap** per user; participant (≤50) and duration (10 min–7 days) bounds; ≤20 problems.
- All writes require a signed-in session; ownership checked on create.
- **No server-side SQL from UGC** (practice-style validation only).
- Accept the client-trusted-rows limitation for casual contests; documented.

## Non-goals (v1)
- Editing/deleting a custom contest after creation; a "my contests" dashboard; kicking participants; separate invite tokens (the slug is the secret); per-viewer timezone override; official-style anti-cheat for custom contests.

## Testing
- **Unit** (`scripts/test-time-ist.ts`, `scripts/test-custom-contests.ts`): `formatIST` (a known UTC → expected IST string), `istLocalInputToUtc` (IST wall-clock → correct UTC, incl. the +5:30 offset), `validateCustomContestInput` (bounds), `canCreate` (cap), slug shape.
- **E2E** (`tests/e2e/custom-contest.spec.ts`): a signed-in user creates a custom contest (seeded via the action or UI) that is LIVE; opens the play page; submits a correct result; sees Accepted; appears in standings. Reuse the LIVE-window pattern (past start, future end) from `contest-standings.spec.ts`.

## Release linkage
Stacked on #161. After #161 merges, rebase onto `main`. Then run the comprehensive system audit (final gate) before widening the audience — it must cover this new UGC surface.
