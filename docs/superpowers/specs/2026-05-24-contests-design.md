# Contests — Design Spec

**Status:** Draft
**Author:** Anchit
**Date:** 2026-05-24
**Roadmap entry:** [`docs/ROADMAP.md` § V2 — Contest](../../ROADMAP.md)
**Related:**
- [`docs/TECHNICAL_DESIGN.md`](../../TECHNICAL_DESIGN.md) — current architecture
- [`docs/superpowers/specs/2026-05-05-sql-engine-v2-foundation-design.md`](./2026-05-05-sql-engine-v2-foundation-design.md) — dialect model used by hidden judging
- [`docs/superpowers/specs/2026-05-03-problem-discussions-design.md`](./2026-05-03-problem-discussions-design.md) — post-contest discussion surface

---

## 1. Overview

Turn Data Learn into a competitive platform by adding timed contests with a leaderboard, a Glicko-2 rating system, and shareable results. Contests come in three flavors:

- **Official contests** — `WEEKLY` and `BIWEEKLY`, run by the platform on a fixed cadence, rated, with hidden test cases.
- **Special contests** — one-off rated events (launch contest, milestone events).
- **Custom contests** — user-created, invite-only, **never rated**, for friend groups to compete on existing problems.

The core trust requirement is that **judging happens server-side against hidden test cases** — the existing client-side DuckDB-WASM judging is insufficient when standings affect a global rating. Everything else (rating, leaderboard, anti-cheat) rests on this.

### Goals

1. Run rated weekly/biweekly contests with a defensible rating system.
2. Let two friends play head-to-head on demand without admin involvement.
3. Make contest outcomes shareable on social media (OG images + public result pages).
4. Provide enough security to make casual cheating expensive and to detect coordinated cheating offline.

### Non-goals (v1)

- Real-time WebSocket leaderboards (polling is sufficient).
- Friend-graph features beyond invite links.
- Team contests, sponsored contests, prize disbursement.
- ML-based plagiarism detection (deterministic SimHash only).
- Mid-contest hint suppression beyond a "Rated mode" Monaco toggle and honor-code modal.
- Native mobile app (PWA covers contest viewing; SQL editing on mobile remains poor UX by design).

---

## 2. User-facing surfaces

| Route | Audience | Purpose |
| --- | --- | --- |
| `/contests` | Public | Upcoming, live, and past **official** contests. |
| `/contests/[slug]` | Public | Contest landing — description, rules, problem count (locked until LIVE), register button. |
| `/contests/[slug]/problems/[n]` | Registered participant (LIVE) / any signed-in user (CLOSED) | In-contest workspace. Reuses `ProblemClient` with a contest banner: timer, problem nav, points. |
| `/contests/[slug]/leaderboard` | Public | Live or finalized standings. |
| `/contests/[slug]/submissions` | Self only (LIVE) / public (CLOSED) | Submission history. |
| `/contests/c/[slug]?key=<token>` | Holders of invite token | Join page for custom contests. |
| `/u/[handle]/contests/[slug]` | Public | Single-contest result page with OG image and share tray. |
| `/u/[handle]` | Public | Profile gains a `ContestRatingCard` and contest history (replaces today's `PlaceholderCard`). |
| `/admin/contests` | Admin | CRUD for official contests, hidden test reveal, anti-cheat review queue. |

The existing `PlaceholderCard("Contests")` in `app/profile/page.tsx:225` becomes the production rating card after this work lands.

---

## 3. Data model

All new tables are additive. Existing `SQLProblem` gains two optional JSON fields for hidden judging; no other model loses or renames a field.

### 3.1 Enums

```prisma
enum ContestKind {
  WEEKLY
  BIWEEKLY
  SPECIAL
  USER_CUSTOM
}

enum ContestStatus {
  SCHEDULED   // before startsAt
  LIVE        // startsAt <= now < endsAt
  CLOSED      // endsAt reached, awaiting finalize job
  FINALIZED   // leaderboard materialized, rating job complete
  CANCELLED   // admin-cancelled; never rated
}

enum ProblemStatus {
  DRAFT
  BETA
  PUBLISHED
  ARCHIVED
  CONTEST_LOCKED   // NEW — set when assigned to an official LIVE/SCHEDULED contest
}
```

### 3.2 New tables (sketch)

```prisma
model Contest {
  id              String         @id @default(cuid())
  slug            String         @unique
  title           String
  description     String         // markdown
  kind            ContestKind
  status          ContestStatus  @default(SCHEDULED)
  startsAt        DateTime
  endsAt          DateTime
  durationMinutes Int            // denormalized for display + sanity checks
  rated           Boolean        @default(true)  // forced false for USER_CUSTOM
  createdById     String
  createdBy       User           @relation(fields: [createdById], references: [id])
  // Custom contest fields
  visibility      String         @default("PUBLIC") // PUBLIC | UNLISTED
  inviteTokenHash String?        // sha256 of the join token; null for official contests
  maxParticipants Int?           // null = no cap (official); 50 for USER_CUSTOM
  // Bookkeeping
  problems        ContestProblem[]
  registrations   ContestRegistration[]
  submissions     ContestSubmission[]
  leaderboard     ContestLeaderboardEntry[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  @@index([status, startsAt])
  @@index([kind, startsAt])
}

model ContestProblem {
  contestId   String
  problemId   String
  position    Int       // 1..n, display order
  points      Int       // contest-local score (e.g., 3/4/5/6)
  contest     Contest    @relation(fields: [contestId], references: [id], onDelete: Cascade)
  problem     SQLProblem @relation(fields: [problemId], references: [id])

  @@id([contestId, problemId])
  @@unique([contestId, position])
}

model ContestRegistration {
  contestId    String
  userId       String
  registeredAt DateTime @default(now())
  ratedAtStart Boolean              // snapshot of (contest.rated && user-eligible) at LIVE moment
  contest      Contest @relation(fields: [contestId], references: [id], onDelete: Cascade)
  user         User    @relation(fields: [userId], references: [id])

  @@id([contestId, userId])
}

model ContestSubmission {
  id            String   @id @default(cuid())
  contestId     String
  userId        String
  problemId     String
  submissionId  String   @unique     // FK to the underlying Submission row created by the judge
  sqlHash       String                // sha256 of normalized SQL; powers SimHash batch
  simhash       BigInt               // 64-bit SimHash
  attemptNumber Int                  // 1-based per (contest,user,problem)
  isAccepted    Boolean
  acceptedAt    DateTime?            // server-stamped on first accept
  submittedAt   DateTime @default(now())
  ipHash        String                // sha256(ip + per-contest salt) — never raw IP
  userAgent     String
  contest       Contest    @relation(fields: [contestId], references: [id], onDelete: Cascade)
  user          User       @relation(fields: [userId], references: [id])
  problem       SQLProblem @relation(fields: [problemId], references: [id])

  @@index([contestId, userId])
  @@index([contestId, problemId, isAccepted])
}

model ContestLeaderboardEntry {
  contestId      String
  userId         String
  rank           Int
  points         Int
  penaltySeconds Int       // sum of (acceptedAt-startsAt) on solved + 300 * wrongAttemptsOnSolved
  solvedCount    Int
  // Populated at FINALIZE for rated contests:
  ratingBefore   Int?
  ratingAfter    Int?
  ratingDelta    Int?
  updatedAt      DateTime  @updatedAt
  contest        Contest   @relation(fields: [contestId], references: [id], onDelete: Cascade)
  user           User      @relation(fields: [userId], references: [id])

  @@id([contestId, userId])
  @@index([contestId, rank])
}

model UserRating {
  userId           String   @id
  rating           Int      @default(1500)
  ratingDeviation  Float    @default(350)
  volatility       Float    @default(0.06)
  contestsPlayed   Int      @default(0)
  peakRating       Int      @default(1500)
  lastContestAt    DateTime?
  user             User     @relation(fields: [userId], references: [id])
}

model ContestRatingHistory {
  id            String   @id @default(cuid())
  userId        String
  contestId     String
  rank          Int
  ratingBefore  Int
  ratingAfter   Int
  delta         Int
  playedAt      DateTime
  user          User     @relation(fields: [userId], references: [id])
  contest       Contest  @relation(fields: [contestId], references: [id])

  @@unique([userId, contestId])
  @@index([userId, playedAt])
}
```

### 3.3 Hidden test cases on `SQLProblem`

Two new optional fields:

```prisma
model SQLProblem {
  // ...existing fields...
  hiddenSchemas         Json?   // map<Dialect, ddl+seed sql string> — never sent to client
  hiddenExpectedOutputs Json?   // map<Dialect, row[]>               — never sent to client
}
```

These remain optional so existing problems continue to work in `/practice` exactly as today. A problem can only be added to an **official** contest if both fields are populated for every dialect the contest accepts. Custom contests do not require hidden data (see §6).

The admin form renders these as opaque `••• hidden •••` controls; revealing them opens a confirm modal and writes an audit log row.

---

## 4. Server-side judging (the trust root)

Without this, every other contest control is decorative.

### 4.1 Architecture

```
client (Monaco) --SQL--> POST /api/contests/[slug]/submit
                              |
                              v
                       contest-judge service
                              |
                  +-----------+-----------+
                  |                       |
            DuckDB (node-api)         PGlite
            per-submission           per-submission
            sandbox                  sandbox
                  |                       |
                  +-----------+-----------+
                              v
                     compare(rows, hiddenExpected[dialect])
                              v
                       write Submission + ContestSubmission
                              v
                  upsert ContestLeaderboardEntry
```

### 4.2 Sandbox guarantees

- **Per-submission isolation**: a fresh DuckDB instance (`@duckdb/node-api`) or PGlite instance per request. Disposed immediately after.
- **Timeouts**: 10s statement timeout enforced both by the engine and by a wrapper `setTimeout` that kills the worker.
- **Memory cap**: 256MB per instance (DuckDB `SET memory_limit='256MB'`).
- **Disabled surface**: DuckDB extensions, `INSTALL`, `LOAD`, `COPY ... FROM`, `READ_CSV_AUTO`, HTTP/`httpfs` functions, file IO, `pragma_*` writes. Done via a whitelist of statement types parsed pre-execution; reject on any unknown form with `400 UNSUPPORTED_STATEMENT`.
- **Resource queue**: single Node worker pool of size `CONTEST_JUDGE_CONCURRENCY` (default 4). Submissions queue; if queue depth exceeds 100, return `503 JUDGE_BUSY` (client retries with backoff).
- **SQL size cap**: 64 KB; rejected before reaching the judge.

### 4.3 Verdict

Standard verdict enum (re-used from existing `Submission.status`):
`ACCEPTED | WRONG_ANSWER | TIME_LIMIT | RUNTIME_ERROR | COMPILE_ERROR | INTERNAL_ERROR`.

Acceptance comparison reuses `lib/sql-validator.ts` (order-aware vs order-insensitive per problem, same comparator the practice flow uses).

### 4.4 Client-side preview vs official verdict

The in-contest workspace still runs the user's SQL against the **public** seed client-side (via the existing `useProblemDB`) so they get an instant "this is what your query returned on the sample data" pane. The accept/reject decision and the leaderboard impact come only from the server's hidden run. The UI labels them distinctly:

- **Sample output** (client, instant) — what your query produces on the visible dataset.
- **Judge verdict** (server, ~1–3s) — official accept/reject against hidden cases.

---

## 5. Scoring and ranking

### 5.1 Score formula

For each user in a contest:

- `points = Σ ContestProblem.points where ContestSubmission.isAccepted=true for first accept`.
- `penaltySeconds = Σ (acceptedAt - contest.startsAt)_seconds on solved + 300 * wrongAttemptsBeforeAccept on solved`.
  - Mirrors LeetCode: wrong submissions on **unsolved** problems do not contribute penalty.
- Ranking: `ORDER BY points DESC, penaltySeconds ASC, firstAcceptedAt ASC` (third key breaks ties deterministically).

### 5.2 Incremental updates

On each accepted submission:

1. Insert `ContestSubmission` row in a transaction.
2. Recompute `(points, penaltySeconds, solvedCount)` for that user only (single query over their `ContestSubmission` rows).
3. Upsert their `ContestLeaderboardEntry`.
4. Recompute `rank` for affected rows lazily on the next leaderboard read using a window function (`RANK() OVER (...)`) — avoids contention from rank rewrites on every submit.

Rejected submissions only insert a `ContestSubmission(isAccepted=false)` row.

---

## 6. Custom contests (friend mode)

`ContestKind.USER_CUSTOM` with these constraints:

- Creator must be signed in with verified email.
- **Always unrated** — `rated=false` enforced server-side regardless of payload.
- **Always unlisted** — `visibility=UNLISTED`, never appears on `/contests`. Discoverable only via the invite URL.
- **Invite token** generated at create time. URL: `/contests/c/<slug>?key=<token>`. Server stores `inviteTokenHash = sha256(token)`. Token is shown to creator exactly once.
- **Quotas** (per-user, sliding 24h window):
  - 5 custom contests created per day.
  - 3 active (`SCHEDULED` or `LIVE`) at any time.
  - 50 participants per contest (`maxParticipants`).
  - 50 invitations sent per day (if explicit invitations land in v1.x).
- **Problem pool**: published problems only. Cannot select `CONTEST_LOCKED`, `DRAFT`, or `ARCHIVED`. No hidden test requirement — judging falls back to the existing client-side flow against the public dataset. The contest is unrated, so the weaker trust model is acceptable.
- **Leaderboard**: materialized like official contests so the share surface works.
- **Lifecycle**: SCHEDULED → LIVE → CLOSED → FINALIZED, but FINALIZE skips the rating job.

This is the explicit trade-off: friend contests are convenient and shareable but never affect rating, because collusion in a group of 4 is undetectable in v1.

---

## 7. Rating system — Glicko-2

### 7.1 Why Glicko-2 over ELO

- Models per-user uncertainty (`RD`) — handles new users and sporadic players cleanly.
- Models volatility — handles inconsistent performance.
- Codeforces variant uses it; the math is well-documented (Glickman 2012).
- Pure functions; trivially testable.

### 7.2 State and defaults

```ts
type UserRating = {
  rating: number;            // default 1500
  ratingDeviation: number;   // default 350
  volatility: number;        // default 0.06 (Glickman's recommended τ-derived initial)
  contestsPlayed: number;    // default 0
  peakRating: number;        // default 1500
  lastContestAt: Date | null;
};
```

Glicko-2 system constant `τ = 0.5` (moderate volatility response, recommended in the paper).

### 7.3 Multi-player update

Standard Glicko-2 tournament treatment, run once per contest at FINALIZE:

1. Pull all `rated` participants and their final `(rank, points)` from `ContestLeaderboardEntry`.
2. For each user `U`, build an opponent list = every other rated participant `O`, with outcome:
   - `1.0` if `U.rank < O.rank` (U finished higher),
   - `0.0` if `U.rank > O.rank`,
   - `0.5` if equal rank (rare — tiebreakers should mostly prevent this).
3. Apply the standard Glicko-2 `update_player(U, opponentList)`.
4. Write `UserRating` (new state), `ContestRatingHistory`, and `ContestLeaderboardEntry.{ratingBefore, ratingAfter, ratingDelta}` in a single transaction.

### 7.4 Eligibility rules

A participant is rated iff:

- Contest `rated=true` (false for `USER_CUSTOM`, always).
- User is signed in with verified email at contest start.
- User submitted ≥1 problem before the contest closed (no-show participants are not rated).
- Account age ≥ 1 day at contest start (anti-throwaway).

Failing any of these flips `ContestRegistration.ratedAtStart=false` and excludes the user from the rating job.

### 7.5 Provisional period

First 3 rated contests per user are flagged provisional. RD floor raised slightly to allow larger swings; profile shows `(?)` next to the rating until the 4th contest finalizes.

### 7.6 Tiers (display only)

| Range | Tier | Color (HSL token) |
| --- | --- | --- |
| <1200 | Newbie | `--tier-newbie` (neutral grey) |
| 1200–1399 | Pupil | `--tier-pupil` (green) |
| 1400–1599 | Specialist | `--tier-specialist` (cyan) |
| 1600–1899 | Expert | `--tier-expert` (blue) |
| 1900–2099 | Candidate Master | `--tier-cm` (purple) |
| 2100–2299 | Master | `--tier-master` (orange) |
| ≥2300 | Grandmaster | `--tier-gm` (red) |

Tier colors added to `app/globals.css` as semantic tokens (do not hard-code).

### 7.7 Implementation

- `lib/glicko2.ts` — pure module: `updatePlayer(state, opponents): newState`. No Prisma.
- Unit tests in `lib/glicko2.test.ts` match the reference values from Glickman's 2012 worked example.
- Finalize job is a server action triggered by an admin or by a Vercel Cron hitting `/api/contests/finalize?slug=...` with the `CRON_SECRET`. Idempotent: re-running on a FINALIZED contest is a no-op.

---

## 8. Leaderboard

### 8.1 Read path

- **Live (SCHEDULED, LIVE)**: server component renders top 100 + viewer's row (sticky if outside top 100). Hydrated client island polls `/api/contests/[slug]/leaderboard?cursor=<rank>` every 15s via SWR. Endpoint has a 5s edge cache to absorb burst load and a per-IP rate limit of 10 req/min.
- **Closed/Finalized**: reads directly from `ContestLeaderboardEntry`. Adds `ratingBefore`, `ratingAfter`, `ratingDelta` columns for rated contests.

### 8.2 Columns

| Column | Mobile? | Notes |
| --- | --- | --- |
| Rank | yes | |
| User | yes | Avatar + handle (country flag deferred — see §15) |
| Q1…Qn | no (collapsed) | Per-problem `mm:ss` at first accept, `—` if unsolved, `+k` superscript for k wrong attempts on solved |
| Points | yes | |
| Penalty | yes | `hh:mm:ss` |
| Δ rating | yes (closed only) | Color by sign, only on rated contests |

### 8.3 Filters

`All` (default), `Friends` (deferred — needs friend graph; show disabled with tooltip), `My country`, `Rated only`.

---

## 9. Social sharing

### 9.1 OG image

Route: `GET /api/og/contest/[slug]/[handle]` powered by `@vercel/og`. Renders:

- Contest title + date
- User avatar, handle, country
- Rank, points, solved/total
- Rating delta with tier-colored arrow (rated only)
- Data Learn wordmark + URL

Cached aggressively after FINALIZE (immutable). For LIVE contests the route returns a generic "in progress" card (no per-user rank — sharing live is intentionally not supported).

### 9.2 Result page

`/u/[handle]/contests/[slug]` — public page that embeds the OG image and a share tray:

- Twitter web intent (`https://twitter.com/intent/tweet?...`)
- LinkedIn share URL
- Reddit submit URL
- "Copy link"
- Web Share API on mobile if available

No third-party SDKs; everything is anchor-tag URLs. Page is OG-tagged so the embed renders natively when the URL itself is pasted.

### 9.3 Post-contest "share your result" panel

After FINALIZE, the participant's contest page shows a "You finished #N — share?" card with one-click buttons to the result page. Shows only for users with `solvedCount >= 1`.

---

## 10. Server-authoritative time (clock-tampering defense)

The client clock is for display only. Every trust decision uses `Date.now()` on the server.

### 10.1 Rules

- **`Contest.startsAt`/`endsAt`** are UTC; the server compares `new Date()` against them on every submit.
- **Submit guards**: any submission with `serverNow < startsAt` or `serverNow > endsAt` returns `409 CONTEST_NOT_LIVE`. No grace window.
- **`acceptedAt`** is set to `new Date()` on the server when the judge returns `ACCEPTED`. The client never supplies times.
- **Idempotency**: submit requests carry an `Idempotency-Key` header (random per click). Identical keys within 5s return the cached verdict — prevents double counting on network retries.
- **Late-tab handling**: server rejects cleanly with `CONTEST_NOT_LIVE`; client shows "Contest ended" with a link to the leaderboard.

### 10.2 Client timer

The client uses a drift-corrected countdown:

1. On mount and every 30s, `GET /api/contests/[slug]/status` returns `{ serverNow, endsAt, status }`.
2. Client computes `drift = serverNow - clientNow` and renders the countdown using `endsAt - (clientNow + drift)`.
3. If the user freezes or rewinds their system clock, the next status poll resnaps. Even without that, submissions are server-judged, so a tampered timer just produces rejected submits.

### 10.3 Why this is enough

A tampered client clock cannot make a late submission count, cannot change `acceptedAt`, and cannot affect the rating job. The only thing it affects is the countdown UI on the cheater's own screen.

---

## 11. Security checklist (consolidated)

### 11.1 AuthN / AuthZ

- All `/api/contests/*` writes require an authenticated session.
- Rated-contest participation requires `emailVerified != null`.
- `/admin/contests/*` requires `session.user.role === 'ADMIN'`.
- Custom contest join requires a valid invite `key` matching `Contest.inviteTokenHash`, or being the creator.

### 11.2 Hidden data isolation

- `hiddenSchemas` and `hiddenExpectedOutputs` are **never** included in any `select` projection used by client-callable server actions. CI grep (or unit test) asserts no `select` over `SQLProblem` includes these field names outside `lib/contest-judge.ts` and `app/admin/**`.
- Admin reveal flow: opening the hidden field requires a "Reveal" click → confirm modal → audit log row (`AdminAuditLog` with action `REVEAL_HIDDEN_TEST`, target `problemId`, actor `userId`). After reveal, fields are visible for the session.
- API responses for live contest problems strip `hidden*` and the public seed itself if marked sensitive (problems set up specifically for contests can hide their seed too).

### 11.3 Judge sandbox

- Per-submission DuckDB / PGlite instance, disposed after.
- 10s statement timeout, 256MB memory cap, file/network/extension functions disabled.
- Pre-execution AST allowlist: `SELECT`, `WITH` (CTE). Reject everything else with `400 UNSUPPORTED_STATEMENT`.
- Worker pool size 4 (configurable via `CONTEST_JUDGE_CONCURRENCY`); queue depth >100 returns `503 JUDGE_BUSY`.

### 11.4 Rate limits (token bucket; Postgres-backed in v1, Redis later)

| Action | Limit |
| --- | --- |
| Submit | ≤1 / 3s per (user, contest); ≤30 / contest |
| Leaderboard poll | 10 / min per IP |
| Custom contest create | 5 / day per user |
| Invitation send (v1.x) | 50 / day per creator |
| Admin contest writes | 60 / min per admin |

### 11.5 Submission storage

- IP hashed with per-contest salt: `ipHash = sha256(ip + contest.salt)`. Raw IP never stored on `ContestSubmission`. Salt rotated per contest so cross-contest correlation requires admin replay.
- UA stored raw (no PII concern).
- SQL stored on the underlying `Submission` row (existing behavior). `ContestSubmission` carries `submissionId` + `sqlHash` + `simhash` only.

### 11.6 Anti-cheat (v1, deterministic only)

- **SimHash**: every accepted submission has a 64-bit SimHash of its token-normalized form (whitespace collapsed, identifiers lowercased, literals stripped). A nightly batch within each closed contest flags pairs with Hamming distance ≤ 4 to an admin review queue.
- **IP clustering**: post-contest, group submissions by `ipHash` within the same contest. Clusters with ≥3 distinct users from one `ipHash` surface in admin review.
- **Public submissions** hidden during LIVE; revealed at CLOSED on `/contests/<slug>/problems/<n>/submissions`.
- **"Rated mode" Monaco toggle**: disables inline AI suggestions and right-click → AI actions in the editor while a rated contest is LIVE. Best-effort; documented as such.
- **Honor-code modal** at LIVE entry: one-time acknowledgement that AI tools are disallowed for rated contests.

### 11.7 Known limitations (documented, not solved)

- Cannot prevent paste from external AI tools in another tab.
- Cannot prevent collusion in `USER_CUSTOM` contests — this is why they're unrated.
- IP fingerprinting is best-effort; mobile networks and VPNs make it noisy. Surfaced as a signal, not a verdict.

---

## 12. Profile integration

`PlaceholderCard("Contests")` in `app/profile/page.tsx:225` is replaced by `<ContestRatingCard userId={…} />`:

- **Current rating + tier pill** (color-coded).
- **Peak rating** (small).
- **Contests played** (small).
- **Sparkline** of the last 10 contest deltas.
- **Link** to `/u/[handle]/contests` — a paginated history list with rank, points, delta per contest.

If the user has zero rated contests, the card shows "Play your first rated contest to get a rating" with a link to `/contests`.

---

## 13. Admin surface

`/admin/contests`:

- List: filter by status/kind, sort by startsAt.
- Create: title, slug, kind, schedule, problems picker (search by number/title; sets `points` + `position` inline), `rated` toggle (locked off for `USER_CUSTOM`).
- Edit: same fields. Cannot edit once status is LIVE. Cannot delete after CLOSED.
- "Reveal hidden test cases" gated per the audit flow in §11.2.
- "Run finalize" button — manually triggers the finalize job; idempotent.
- Anti-cheat review queue: SimHash matches + IP clusters, each row links to the two submissions side-by-side.

### 13.1 MCP server additions

New tools in `mcp-server/` mirroring the admin surface:

- `create_contest` — DRAFT-equivalent: created in `SCHEDULED` status only, never schedules in the past.
- `add_contest_problem` — adds a `ContestProblem` row.
- `set_contest_problem_points`, `remove_contest_problem`.
- `set_problem_hidden_dataset` — writes `hiddenSchemas` + `hiddenExpectedOutputs` for a dialect. Idempotent.
- `publish_contest` — flips `SCHEDULED` validations: every problem has hidden data for every dialect.

Following the existing MCP pattern: omit-then-inject for any field that must be human-controlled. The MCP can never set `status` directly.

---

## 14. Phasing (informs the implementation plan)

Each phase is a self-contained PR sequence. Later phases assume earlier phases are merged to `main`.

| # | Phase | Why it lands separately |
| --- | --- | --- |
| 1 | **Foundation** — schema (incl. hidden fields, `CONTEST_LOCKED`), admin CRUD, public listing, registration | Establishes the data model + admin tools without any judging code. Mergeable on its own. |
| 2 | **Server-side judge** — `lib/contest-judge.ts`, sandboxed DuckDB worker, `/api/contests/[slug]/submit`, hidden-data audit log | Blocks all rated functionality; the trust root. |
| 3 | **Runtime** — in-contest workspace UI, drift-corrected timer, incremental scoring, polling leaderboard, post-contest practice mode | The user-visible "it's a contest" experience. |
| 4 | **Rating** — `lib/glicko2.ts` + tests, finalize job, `UserRating`/`ContestRatingHistory`, profile `ContestRatingCard`, tier color tokens | Turns it into a *rated* experience. |
| 5 | **Custom contests** — `USER_CUSTOM` kind, invite tokens, quotas, join page | Friend-play mode. Independent of rating. |
| 6 | **Social + sharing** — OG route, public result page, share tray, post-contest share panel | Network growth. Depends on FINALIZE being live. |
| 7 | **Anti-cheat + polish** — SimHash batch, IP clustering, admin review queue, honor-code modal, "Rated mode" Monaco toggle | Hardening. Can ship incrementally. |

---

## 15. Open questions (to resolve before plan-out)

1. **Judge engine for the Postgres dialect**: PGlite (WASM in Node) vs ephemeral Neon branch. PGlite is simpler and cheaper; Neon branches are fully behavior-equivalent to production but cost more and need lifecycle management. **Lean: PGlite for v1.**
2. **Country flag on leaderboard**: needs a `User.country` field (currently absent). **Lean: defer; ship leaderboard without flag, add a column later.**
3. **Friends filter on leaderboard**: needs a friend graph. **Lean: defer; show disabled with "Coming soon" tooltip.**
4. **Cron scheduler**: Vercel Cron supports up to 1-minute granularity on Pro; current plan is Hobby. **Lean: use a one-off Vercel Cron job that polls every 5 minutes for contests needing FINALIZE, or upgrade plan if cadence tightens.**
5. **Email notifications** for "your contest starts in 1 hour": requires Resend or similar. **Lean: separate spec; not blocking contest v1.**

---

## 16. Success criteria

- One weekly contest runs end-to-end with ≥50 participants without manual intervention.
- Judge median latency <2s, p95 <5s under contest load (50 concurrent submitters).
- Glicko-2 unit tests match Glickman 2012 worked example to 4 decimal places.
- Zero leaks of `hiddenSchemas` or `hiddenExpectedOutputs` to client (verified via grep + integration test).
- At least one shareable contest result post (OG image) per participant who finishes.
- Custom-contest creation works for 2 friends in <60s from sign-in.
