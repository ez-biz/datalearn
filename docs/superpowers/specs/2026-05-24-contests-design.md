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

// ProblemStatus is UNCHANGED. Earlier drafts of this spec proposed a
// CONTEST_LOCKED value; that approach was rejected because every public
// surface (practice list, tracks, tags, profile, lists, search) gates on
// status == PUBLISHED, and reusing the status field to hide a problem from
// those surfaces would silently break learning paths whenever a problem
// was assigned to a contest. Locking is modeled separately — see §3.4.

enum ContestVerdict {
  ACCEPTED         // hidden run matched expected output
  WRONG_ANSWER     // hidden run completed but output differed
  TIME_LIMIT       // judge killed the query after the wall-clock cap
  MEMORY_LIMIT     // engine hit the memory cap
  RUNTIME_ERROR    // query parsed but errored (e.g., division by zero, type cast)
  COMPILE_ERROR    // query failed to parse / referenced unknown identifier
  REJECTED         // pre-execution rejection (statement allowlist, size cap, banned function)
  INTERNAL_ERROR   // judge crashed / queue overflow / dispatcher fault — NEVER counts as a wrong attempt
}
```

`ContestVerdict` is a new enum, distinct from the existing `SubmissionStatus`
(which only has `ACCEPTED`/`WRONG_ANSWER` and is unchanged). The underlying
`Submission` row created by the judge stores `SubmissionStatus.ACCEPTED` or
`WRONG_ANSWER` for compatibility with existing UI, while `ContestSubmission`
carries the richer `ContestVerdict`. Only `WRONG_ANSWER` and `RUNTIME_ERROR`
count as wrong attempts for penalty purposes; `TIME_LIMIT`, `MEMORY_LIMIT`,
`COMPILE_ERROR`, `REJECTED`, and `INTERNAL_ERROR` are recorded for history
and admin review but do **not** contribute to penalty (these are usually
infrastructure or user-typo signals, not "wrong solve" signals).

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
  id              String          @id @default(cuid())
  contestId       String
  userId          String
  problemId       String
  submissionId    String          @unique     // FK to the underlying Submission row created by the judge
  idempotencyKey  String                       // client-supplied per click; see §10
  sqlHash         String                       // sha256 of normalized SQL; powers SimHash batch
  simhash         BigInt                       // 64-bit SimHash
  attemptNumber   Int                          // 1-based per (contest,user,problem)
  verdict         ContestVerdict
  acceptedAt      DateTime?                    // server-stamped iff verdict=ACCEPTED
  submittedAt     DateTime        @default(now())
  ipHash          String                       // sha256(ip + per-contest salt) — never raw IP
  userAgent       String
  contest         Contest         @relation(fields: [contestId], references: [id], onDelete: Cascade)
  user            User            @relation(fields: [userId], references: [id])
  problem         SQLProblem      @relation(fields: [problemId], references: [id])

  // ---- Durable de-duplication / double-count defenses ----
  // 1. Same (user, contest, idempotencyKey) submit twice → DB rejects, server
  //    returns the cached row's verdict. Survives multi-instance/serverless
  //    races and outlives any in-process cache.
  @@unique([contestId, userId, idempotencyKey])
  // 2. attemptNumber is monotonic per (contest, user, problem). Server picks
  //    it via SELECT MAX inside the same transaction that inserts the row;
  //    the unique constraint catches racing inserts and forces a retry.
  @@unique([contestId, userId, problemId, attemptNumber])

  @@index([contestId, userId])
  @@index([contestId, problemId, verdict])
}

// First-accept is the load-bearing fact for scoring/rating. We model it as
// its own table with a hard uniqueness constraint so that a concurrent
// double-accept can never produce two "first solve" rows even under retry
// storms, leader failovers, or judge instance restarts.
model ContestProblemSolve {
  contestId     String
  userId        String
  problemId     String
  submissionId  String   @unique     // points at the winning ContestSubmission.submissionId
  acceptedAt    DateTime              // server-stamped, immutable
  wrongAttemptsBeforeAccept Int       // computed at insert time from ContestSubmission history
  contest       Contest    @relation(fields: [contestId], references: [id], onDelete: Cascade)
  user          User       @relation(fields: [userId], references: [id])
  problem       SQLProblem @relation(fields: [problemId], references: [id])

  // Hard guarantee: at most ONE first-solve row per (contest, user, problem).
  @@id([contestId, userId, problemId])
  @@index([contestId, problemId, acceptedAt])
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

### 3.3 Problem locking (replaces the rejected `CONTEST_LOCKED` approach)

`ProblemStatus` stays exactly as it is today. Locking lives in its own table
so that **no existing visibility code path needs to change unless we
explicitly opt it in**:

```prisma
model ContestProblemLock {
  problemId   String   @id                      // one active lock per problem, enforced by PK
  contestId   String
  lockedAt    DateTime @default(now())
  unlocksAt   DateTime                          // = contest.endsAt at lock time
  problem     SQLProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  contest     Contest    @relation(fields: [contestId], references: [id], onDelete: Cascade)

  @@index([unlocksAt])
}
```

Lifecycle:

1. Admin assigns a problem to an official contest → server `INSERT` into
   `ContestProblemLock` inside the same transaction as the `ContestProblem`
   row. If the problem is already locked for another active contest, the PK
   uniqueness rejects the insert and the admin sees a clear error.
2. Contest finalization (or contest cancellation) → `DELETE` the lock rows
   for that contest in the same transaction that flips status to
   `FINALIZED`/`CANCELLED`.
3. A background sweep (`/api/contests/sweep-locks`, cron every 5 min) deletes
   any locks where `unlocksAt < now()` as a safety net for missed
   finalization.

Practice / list / tag / track / search / profile queries get a **single
opt-in helper** `excludeLockedProblems(query)` that adds
`WHERE id NOT IN (SELECT problemId FROM ContestProblemLock)` (or a
`LEFT JOIN ... WHERE lock.problemId IS NULL`). The audit list is fixed and
small:

- `actions/problems.ts` (list, search, getBySlug-for-practice)
- `actions/tracks.ts` (track problem listings)
- `actions/lists.ts` (custom list rendering — locked problems render as
  "Locked: in contest until <time>" rather than disappearing, so users
  don't think their list is corrupt)
- `actions/profile.ts` (recent solved — historical entries are fine; only
  new "practice this" CTAs need gating)
- `actions/submissions.ts` (search / history — show but disable rerun CTA)
- Any admin surface uses the raw query (locked problems remain visible to
  admins).

Custom contests (`USER_CUSTOM`) **do not create locks** — they reuse
already-public problems and never need to hide them. Only official
(`WEEKLY`/`BIWEEKLY`/`SPECIAL`) contests lock.

### 3.4 Hidden test cases on `SQLProblem`

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

### 4.2 Sandbox guarantees — defense in depth

A statement-type allowlist alone is insufficient: dangerous behavior lives
inside SELECT expressions (e.g., `SELECT * FROM read_csv_auto('/etc/passwd')`,
`SELECT httpfs_get('http://169.254.169.254/latest/meta-data/iam/security-credentials/')`,
`SELECT ... FROM (ATTACH 'malicious.duckdb'; SELECT * FROM …)`). The judge
must defend at four layers:

**Layer 1 — Process isolation**

Each submission runs in a forked Node worker (`worker_threads` or
`child_process.fork`), not in the main API process. The worker:

- inherits no inheritable env (we pass `{}` plus an explicit allowlist),
- runs with `--no-addons --disable-proto=delete --no-deprecation`,
- has its CWD set to an empty tmpdir created per submission, deleted after,
- on Linux production (Vercel/Node 22), uses `process.kill(worker.pid, 'SIGKILL')` on timeout,
- is recycled after every submission (no long-lived state).

**Layer 2 — Engine configuration (DuckDB)**

Before loading any user SQL, the judge runs this fixed prelude and rejects
the submission if any statement fails:

```sql
SET memory_limit = '256MB';
SET threads = 1;
SET allow_unsigned_extensions = false;
SET autoinstall_known_extensions = false;
SET autoload_known_extensions = false;
SET enable_external_access = false;       -- disables httpfs, http_get, COPY FROM URL
SET disabled_filesystems = 'LocalFileSystem,HTTPFileSystem,S3FileSystem';
SET lock_configuration = true;             -- subsequent SET statements no-op
```

`enable_external_access=false` is the most important line — it blocks every
file/network function in one switch. The other lines are belt-and-suspenders
in case a future DuckDB release adds a new external surface.

**Layer 3 — Statement-level validation**

User SQL is parsed with `duckdb.parse_sql()` (returns the parsed AST without
executing it) and then walked:

- Top-level statement type must be `SELECT_STATEMENT` or `WITH` (CTE) wrapping a SELECT.
  Reject `COPY`, `ATTACH`, `DETACH`, `INSTALL`, `LOAD`, `PRAGMA`, `SET`, `CALL`,
  `EXPORT DATABASE`, `IMPORT DATABASE`, `CREATE ... AS`, `INSERT`, `UPDATE`,
  `DELETE`, `BEGIN`, `COMMIT`, `ROLLBACK`.
- Recursive walk of every expression: function names checked against a
  **denylist** that includes (non-exhaustive, kept in `lib/contest-judge-denylist.ts`):
  `read_csv`, `read_csv_auto`, `read_parquet`, `read_json`, `read_json_auto`,
  `read_text`, `read_blob`, `parquet_scan`, `glob`, `parquet_metadata`,
  `httpfs_get`, `http_get`, `http_post`, `s3_*`, `azure_*`, `gcs_*`,
  `copy_from`, `execute`, `pragma_*`, `attach`, `detach`, `install`,
  `load_extension`, `force_install`, anything starting with `duckdb_` that
  introspects extensions/filesystems.
- Reject (verdict `REJECTED`, status 400) on any denylisted function with the
  function name surfaced in the error so the user knows why.

**Layer 4 — Resource bounds**

- 10s wall-clock budget enforced by both the engine (`SET statement_timeout`)
  and a worker-level `setTimeout` that hard-kills if the engine ignores it.
- 256MB memory cap (engine), worker recycled if RSS exceeds 512MB (safety net).
- Worker pool size `CONTEST_JUDGE_CONCURRENCY` (default 4). Queue depth >100
  returns `503 JUDGE_BUSY` (client retries with backoff + jitter).
- SQL size cap: 64 KB, rejected before the parser runs.

**Layer 5 — Regression tests**

A test file `lib/contest-judge.escape-attempts.test.ts` runs a fixed corpus
of known escape attempts on every CI run. Each test asserts `verdict =
REJECTED` (or `RUNTIME_ERROR` if the engine refuses) and that no file/network
side effect occurred. The corpus starts with at minimum:

| # | Attack | Expected |
| --- | --- | --- |
| 1 | `SELECT * FROM read_csv_auto('/etc/passwd')` | REJECTED (denylist) |
| 2 | `SELECT httpfs_get('http://169.254.169.254/…')` | REJECTED (denylist) |
| 3 | `INSTALL httpfs; LOAD httpfs; SELECT …` | REJECTED (top-level INSTALL) |
| 4 | `ATTACH 'x.duckdb'; SELECT 1;` | REJECTED (top-level ATTACH) |
| 5 | `PRAGMA disable_verification; SELECT 1` | REJECTED (top-level PRAGMA) |
| 6 | `WITH t AS (SELECT read_csv('x')) SELECT * FROM t` | REJECTED (denylist inside CTE) |
| 7 | `SELECT generate_series(1, 1e12)` | TIME_LIMIT (resource bound) |
| 8 | `SELECT repeat('x', 1000000000)` | MEMORY_LIMIT |
| 9 | 64 KB + 1 byte SELECT | REJECTED (size cap) |
| 10 | `SELECT pg_read_file('x')` (PGlite) | REJECTED (denylist) |

New escape vectors discovered post-launch land in this corpus before the fix
ships.

**PGlite-specific notes**

PGlite runs Postgres compiled to WASM in-process, so it inherits the worker
isolation automatically (it cannot see the host filesystem). The Layer-3
denylist gains Postgres-specific entries: `pg_read_file`, `pg_read_binary_file`,
`pg_ls_dir`, `lo_import`, `lo_export`, `copy ... program`. Extensions are
not installable in PGlite, so layers 2 and 4 simplify.

### 4.3 Verdict

Verdicts are stored on `ContestSubmission.verdict` using the dedicated
`ContestVerdict` enum defined in §3.1. The underlying `Submission` row uses
the existing `SubmissionStatus` enum (`ACCEPTED` | `WRONG_ANSWER`) for UI
compatibility — non-ACCEPTED contest verdicts map to `WRONG_ANSWER` on the
`Submission` row but retain their precise classification on the
`ContestSubmission` row.

Acceptance comparison reuses `lib/sql-validator.ts` (order-aware vs
order-insensitive per problem, same comparator the practice flow uses).
Penalty accrual rules are in §5.1.

### 4.4 Client-side preview vs official verdict

The in-contest workspace still runs the user's SQL against the **public** seed client-side (via the existing `useProblemDB`) so they get an instant "this is what your query returned on the sample data" pane. The accept/reject decision and the leaderboard impact come only from the server's hidden run. The UI labels them distinctly:

- **Sample output** (client, instant) — what your query produces on the visible dataset.
- **Judge verdict** (server, ~1–3s) — official accept/reject against hidden cases.

---

## 5. Scoring and ranking

### 5.1 Score formula

For each user in a contest:

- `points = Σ ContestProblem.points` joined to `ContestProblemSolve` for that user (the table guarantees at most one solve row per `(contest, user, problem)`, so double-counting is impossible by construction).
- `penaltySeconds = Σ (ContestProblemSolve.acceptedAt - contest.startsAt)_seconds + 300 * ContestProblemSolve.wrongAttemptsBeforeAccept`.
  - Mirrors LeetCode: wrong submissions on **unsolved** problems do not contribute penalty.
  - Only `verdict IN (WRONG_ANSWER, RUNTIME_ERROR)` count toward `wrongAttemptsBeforeAccept`. `TIME_LIMIT`, `MEMORY_LIMIT`, `COMPILE_ERROR`, `REJECTED`, and `INTERNAL_ERROR` are excluded — those reflect infrastructure or pre-execution issues, not "you got the answer wrong."
- Ranking: `ORDER BY points DESC, penaltySeconds ASC, MIN(ContestProblemSolve.acceptedAt) ASC` (third key breaks ties deterministically using the earliest first-solve time).

### 5.2 Submit pipeline (idempotent + safe under concurrency)

Every submit goes through this single transaction in `lib/contest-judge.ts`:

```
BEGIN
  -- 1. Idempotency check (DB-enforced, not in-process cache)
  SELECT * FROM ContestSubmission
   WHERE contestId = $c AND userId = $u AND idempotencyKey = $k
   FOR UPDATE;
  IF FOUND: return cached verdict, COMMIT.

  -- 2. Liveness check uses server clock only (see §10)
  SELECT startsAt, endsAt FROM Contest WHERE id = $c FOR SHARE;
  IF NOT LIVE: COMMIT, return 409 CONTEST_NOT_LIVE.

  -- 3. Reserve attemptNumber atomically
  SELECT COALESCE(MAX(attemptNumber), 0) + 1
    FROM ContestSubmission
   WHERE contestId = $c AND userId = $u AND problemId = $p
   FOR UPDATE;

  -- 4. Run judge OUTSIDE the txn (released advisory lock), then re-enter
  -- 5. Insert ContestSubmission with (idempotencyKey, attemptNumber, verdict)
  --    Unique constraints catch any race; on conflict we retry once with
  --    a fresh attemptNumber.

  -- 6. If verdict = ACCEPTED, attempt first-solve insert:
  INSERT INTO ContestProblemSolve (contestId, userId, problemId, submissionId,
                                   acceptedAt, wrongAttemptsBeforeAccept)
       VALUES (...)
  ON CONFLICT (contestId, userId, problemId) DO NOTHING;
  -- The PK guarantees only the FIRST accept wins. Any second accept for the
  -- same triple silently does nothing — the user still sees ACCEPTED, but
  -- their score/penalty is not double-counted.

  -- 7. If first-solve insert succeeded (FOUND), recompute leaderboard row
  --    for THIS user only:
  UPDATE ContestLeaderboardEntry SET ...
  -- otherwise leaderboard unchanged.
COMMIT;
```

Rank is **not** stored eagerly on every submit. The leaderboard read path
computes rank with `RANK() OVER (ORDER BY points DESC, penaltySeconds ASC, ...)`
in the same query that fetches the page; this avoids cross-row writes on
every submit and removes one whole class of concurrency bug.

Rejected submissions (`verdict != ACCEPTED`) still insert their
`ContestSubmission` row (for history, anti-cheat audit, attempt count) but
never touch `ContestProblemSolve` or the leaderboard.

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
- **Problem pool**: published problems only (`status = PUBLISHED`). Locked problems (those in an active official contest — see §3.3) are also excluded. No hidden test requirement — judging falls back to the existing client-side flow against the public dataset. The contest is unrated, so the weaker trust model is acceptable.
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
- **Idempotency**: submit requests carry an `Idempotency-Key` header (UUID, generated client-side per click). The key is persisted on `ContestSubmission.idempotencyKey` with a DB unique constraint per `(contestId, userId)` (§3.2). A retry with the same key — within the same process, across processes, after a serverless cold start, or hours later — returns the cached verdict without re-running the judge. There is no in-memory cache to expire.
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
- Five layers of defense per §4.2 (process isolation, engine config, statement-level + expression-level validation, resource bounds, regression test corpus). A pure statement-type allowlist is **not** sufficient and is explicitly rejected as insecure (functions like `read_csv_auto` live inside SELECT).
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
| 1 | **Foundation** — schema (Contest, ContestProblem, ContestProblemLock, hidden fields on SQLProblem, ContestVerdict enum), admin CRUD, `excludeLockedProblems` helper + audit of the gates listed in §3.3, public listing, registration | Establishes the data model + admin tools without any judging code. Mergeable on its own. |
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
