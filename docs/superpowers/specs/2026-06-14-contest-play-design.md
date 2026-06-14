# Contest Play — design

**Status:** approved 2026-06-14
**Author:** Anchit (with Claude)
**Related:** [`2026-05-24-contests-design.md`](./2026-05-24-contests-design.md), [`2026-06-14-contest-standings-design.md`](./2026-06-14-contest-standings-design.md), `docs/ROADMAP.md` (V2 — Contest, Phase 3)

## Problem

Contests Phase 1 (foundation) and Phase 2 (server-side judge) shipped, and the
standings table was just added. But a product audit found the **load-bearing
gap**: there is no UI to actually *compete*. No frontend code calls the contest
judge (`POST /api/contests/[slug]/submit`); the contest page links problems to
`/practice/[slug]`, where the problem is **locked** and the practice submit path
(`validateSubmission`) rejects it with "locked for an active contest". So a
registered learner during a live contest hits a dead end, and the leaderboard
stays permanently empty. The Phase 2 judge/queue/scoring backend is fully built
but unreachable.

This spec makes contests **playable**: a registered learner can open a contest
problem during a LIVE contest, test their SQL locally, submit to the judge, and
see a verdict — with a live countdown and times shown in their own timezone.

## Goals

- A registered learner can submit a contest problem to the server judge and see
  a verdict; an accepted submission updates the (already-wired) leaderboard.
- A focused, dedicated play route that keeps contest semantics separate from the
  practice page.
- Time-bound feel: a countdown to the contest end, and times rendered in the
  viewer's locale (fixes the current server-timezone bug).

## Non-goals (deferred — added to ROADMAP)

- Live auto-refreshing standings (this stays fresh-on-load).
- Per-problem ICPC grid on standings.
- Rating / Glicko-2 (the big roadmap item).
- Mobile-stacked standings table (responsive polish).
- "Review my submissions" history on a closed contest.
- Light wrong-answer hints (verdict is verdict-only by decision).

## Key architectural fact

Contests judge **server-side**: the browser sends **raw SQL**, and the server
runs it against **hidden** test data. This is fundamentally different from
practice, where the browser runs SQL in-WASM and only the *result rows* are
validated (`SqlPlayground.onSubmit(userResult)`). Therefore the contest client
cannot reuse the practice playground's submit; it is built from the lower-level
primitives (`SqlEditor`, `ResultTable`, `useProblemDB`) plus a submit that POSTs
SQL text. Local "Run" still uses the problem's **public** sample schema so the
learner can test; the judge alone (hidden data) decides the verdict.

## Architecture

### 1. Route + access control — `app/contests/[slug]/[problemSlug]/page.tsx` (server)

- Fetch contest via `getContestBySlug(slug)` and the problem via
  `getProblem(problemSlug)` (reuses practice's loader: `schema.sql`,
  `description`, `schemaDescription`, `dialects`).
- Verify the problem is attached to the contest (it appears in
  `contest.problems`); else `notFound()`.
- Derive gating from `contest.status` + session + registration, and pass a
  single `mode` to the client:
  - not signed in → `mode: "SIGNED_OUT"` (prompt sign-in)
  - `SCHEDULED` → `mode: "NOT_STARTED"`
  - `CLOSED` → `mode: "ENDED"` (editor visible, submit disabled)
  - `LIVE` + not registered → `mode: "NOT_REGISTERED"` (link back to register)
  - `LIVE` + registered → `mode: "PLAY"`
- Registration is read with `prisma.contestRegistration.findUnique`.
- The API enforces the same rules server-side (defense in depth); the page is
  the friendly surface.

### 2. `ContestPlayClient` (client) — `components/contests/play/ContestPlayClient.tsx`

Props: `{ contestSlug, endsAt: string (ISO), problem: { id, number, title, slug, schemaSql, dialects, ... }, position, points, dialect, mode }`.

The page passes a single active `dialect = problem.dialects[0]` (nearly all
problems are single-dialect). A multi-dialect toggle is a minor follow-up and is
out of scope here; both the local engine and the judge submission use this one
active dialect.

- **Header:** `‹ back to contest`, problem letter + `#number. title`, points badge,
  and `<ContestCountdown endsAt>`.
- **Editor + local Run:** `useProblemDB(schemaSql, dialect, { problemSlug })` →
  `<SqlEditor value onChange onRun={runLocal} dialect />`; `runLocal` calls
  `runQuery(sql)` and renders `<ResultTable data={rows} />`. This lets the user
  iterate against sample data; it is *not* the judge.
- **Submit:** enabled only in `mode === "PLAY"` and before the countdown hits 0.
  POSTs to `/api/contests/${contestSlug}/submit` with
  `{ problemId, sql, dialect, idempotencyKey: crypto.randomUUID() }`. On
  `{ data: { verdict, attemptNumber, acceptedAt } }`, renders the verdict panel.
  Maps non-2xx: 403 → "You're not registered", 409 → "Contest isn't live",
  401 → "Sign in", else generic error.
- **Verdict panel** (verdict-only; no hidden-data leak): pure mapper
  `verdictLabel(verdict)` → `{ icon, text, tone }`, e.g.
  `ACCEPTED → "✓ Accepted"`, `WRONG_ANSWER → "✗ Wrong Answer"`,
  `RUNTIME_ERROR → "✕ Runtime Error"`, `TIME_LIMIT → "Time Limit Exceeded"`, etc.
  Shows `· attempt N` and, on accept, `(+{points} pts)`.

### 3. Shared pieces

- `components/contests/play/ContestCountdown.tsx` (client): ticks every second
  from `endsAt`; renders `H:MM:SS` (reuse `formatPenalty`-style logic, but a
  dedicated `formatRemaining(ms)`); calls an `onExpire` so the parent disables
  submit; shows "Contest ended" at 0.
- `components/ui/LocalTime.tsx` (client): renders a `Date`/ISO string via
  `toLocaleString()` **on the client**, so contest times show in the viewer's
  timezone. Replaces the server-side `.toLocaleString()` calls in
  `app/contests/page.tsx` and `app/contests/[slug]/page.tsx`.
- Pure helpers in `lib/contests/play.ts`: `verdictLabel`, `formatRemaining`,
  `gatingFromStatus(status, signedIn, registered)` → the `mode` union. Kept pure
  for unit tests.

### 4. Wiring — `app/contests/[slug]/page.tsx`

- When `contest.status === "LIVE"`, the problem-list links point to
  `/contests/[slug]/[problemSlug]` (the play page) instead of `/practice/[slug]`.
  Otherwise (CLOSED review) they may link to the play page in `ENDED` mode.
- Replace the two `startsAt/endsAt` `.toLocaleString()` renders with `<LocalTime>`.

## Data flow

```
/contests/[slug]/[problemSlug] (server)
  ├─ getContestBySlug(slug)         → status, problems, endsAt
  ├─ getProblem(problemSlug)        → schemaSql, dialects, description
  ├─ contestRegistration.findUnique → registered?
  └─ gatingFromStatus(...)          → mode
       └─ <ContestPlayClient ... mode endsAt problem />
            ├─ useProblemDB → local Run → ResultTable   (public sample data)
            └─ Submit → POST /api/contests/[slug]/submit (raw SQL)
                 → server judge (hidden data) → { verdict, attemptNumber }
                 → verdictLabel() → verdict panel; leaderboard updated server-side
```

## Error handling

- Submit network/API errors surface inline in the verdict panel with a retry;
  they never crash the page. The countdown reaching 0 disables submit client-side
  (the API also rejects with 409 once `endsAt` passes — defense in depth).
- `useProblemDB` failures (WASM) render the existing engine-error treatment from
  the practice path; local Run is best-effort and independent of submit.

## Testing

- **Unit** (`scripts/test-contest-play.ts`, tsx + `node:test`):
  - `verdictLabel`: every `ContestVerdict` maps to a stable label/tone; ACCEPTED
    includes points.
  - `formatRemaining`: `0 → "0:00:00"`, `750_000ms → "0:12:30"`, negative clamps
    to `"0:00:00"`.
  - `gatingFromStatus`: the truth table (signed-out / not-started / ended /
    not-registered / play).
- **E2E** (`tests/e2e/contest-play.spec.ts`): seed a LIVE contest, a registered
  user, and an attached problem **with hidden test data** (so the judge can run);
  open `/contests/[slug]/[problemSlug]`, type the known-correct SQL, Submit, and
  assert the verdict shows "Accepted" and the contest standings then list the
  user. Use the relative-time LIVE-window pattern from
  `contest-standings.spec.ts` (past start, future end).

## Release linkage

This is the missing piece that makes contests usable. Once it merges, the
`main → production` release (PR #160) can ship contests publicly. Until then,
#160 should not merge (it would expose a non-functional contest surface).
