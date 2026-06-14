# Handoff — Contests Phase 2 (Server-Side Judge) plan committed, hardened through three Codex passes

**Date:** 2026-05-26
**From:** Claude session that wrote the Phase 2 (server-side judge) plan and ran two consecutive Codex adversarial passes on it, folding 8 findings back into the plan across two revision rounds.
**Continues:** `docs/superpowers/handoff/2026-05-24-contests-spec-and-plan-handoff.md` (Phase 1 plan + spec; PR #145 then merged externally by the user).
**For:** the next AI / engineer.

## TL;DR

1. **Phase 1 shipped.** PR #145 was merged externally between sessions (~49 files, +6752/-168). All major schema, admin REST, public surfaces, registration, sweep cron, admin UI, and Playwright happy path landed per plan. Two known follow-ups left open: ESLint 10.4.0 `react/display-name` crash blocks `npm run lint` (pre-existing plugin compat issue), and Vercel rejected the 5-minute sweep cron on the current plan (deferred; lock filter is time-aware without it).

2. **Phase 2 plan written and hardened.** `docs/superpowers/plans/2026-05-24-contests-phase-2-judge.md`, ~3300 lines, 14 tasks. Three Codex adversarial passes ran against it; 8 findings (4 from pass 2, 4 from pass 3) all folded back in via two revision commits. **No code written yet — the plan is the deliverable.**

3. **Key architectural shifts from the original draft:**
   - **Process isolation** is now `child_process.fork` with a `tsup`-compiled `.cjs` worker artifact, not `worker_threads`. There's a production-build smoke test gate via `/api/admin/_judge-selftest`.
   - **SQL validator is AST-based**, not token-based. `duckdb.json_serialize_sql()` for DuckDB, `libpg-query` (new dep) for Postgres. Walks the whole tree and rejects DML/DDL anywhere — including inside CTE bodies (`WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d` was the load-bearing miss in the original).
   - **Hidden data carries a validation fingerprint** (sha256 over `hiddenSchemas + expected + solutions + dialects + ordered`), not just a timestamp. The existing admin problem-update route nulls both validation fields on any edit touching those inputs; the status endpoint recomputes the fingerprint from current DB state and reports `validationStale: true` on drift; `publish_contest` blocks readiness on stale validation.
   - **Reveal vs status split** — `/hidden-data` returns bodies and writes `REVEAL_HIDDEN_TEST` (session-only, rejects API-key callers). `/hidden-data/status` returns presence + hashes + `validatedAt` only — no bodies, no audit pollution. MCP `publish_contest` uses `/status`.
   - **Slot-reserving judge queue** that hands slots directly to waiters; no transient free state for racing callers to slip into. Regression test asserts `maxObserved ≤ CONCURRENCY` under a 4× burst.
   - **SimHash stored as hex string**, not BigInt. Postgres BIGINT is signed; half of unsigned 64-bit hashes would overflow on insert.

## Where things stand

### Production
- v0.6.x line still live. v0.6.2 release status from prior memory remains unresolved this session — wasn't touched.
- Phase 1 (PR #145) merged to `main`; release-to-production status not verified this session.

### `main`
- Last fetched: stale (local `main` hasn't been pulled since before PR #145 merged). Re-fetch before any new work.

### Local branch (not pushed)
- **`fix/mcp-e2e-redact-key-log`** — now 6 commits ahead of origin. Same branch hygiene issue as the prior handoff, now bigger:
  - `45eb861` — fix(mcp): redact e2e api key cleanup log  ← the legitimate one-line MCP fix
  - `f072ef8` — docs(spec): contests v1 design
  - `5d08a28` — docs(spec): contests — Codex pass 1
  - `b71f7c0` — docs(plan): contests Phase 1 foundation
  - `d37dde3` — docs(plan): contests Phase 2 judge
  - `6c84774` — docs(plan): contests Phase 2 Codex pass 2 revisions
  - `e66c373` — docs(plan): contests Phase 2 Codex pass 3 revisions

The contests docs (6 commits, top of stack) belong on their own branch, e.g. `docs/contests-spec-and-plans`. Split them before pushing either work item.

## Documents produced across these sessions

| Path | Lines | Status |
| --- | --- | --- |
| `docs/superpowers/specs/2026-05-24-contests-design.md` | ~900 | Final after Codex pass 1 (5d08a28). |
| `docs/superpowers/plans/2026-05-24-contests-phase-1-foundation.md` | ~2,687 | Shipped as PR #145. Reference only. |
| `docs/superpowers/plans/2026-05-24-contests-phase-2-judge.md` | ~3,300 | Final after Codex passes 2 + 3. **Ready to execute.** |
| `docs/superpowers/handoff/2026-05-24-contests-spec-and-plan-handoff.md` | — | Prior handoff. |
| `docs/superpowers/handoff/2026-05-26-contests-phase-2-plan-handoff.md` | this file | Current handoff. |

## Codex pass log — what each pass found

### Pass 1 (against the spec, 2026-05-24) — 4 findings, all folded into `5d08a28`
1. Double-counting under retries/concurrency → DB-backed idempotency key + per-attempt uniqueness + separate `ContestProblemSolve` table.
2. `CONTEST_LOCKED` status overload → separate `ContestProblemLock` table + `excludeLockedProblems` audit list.
3. Shallow sandbox allowlist → five-layer defense.
4. Verdict enum mismatch → dedicated `ContestVerdict`.

### Pass 2 (against the Phase 2 plan, 2026-05-25) — 4 findings, all folded into `6c84774`
1. **High** — worker_threads not actually process-isolated; production path unverified → `child_process.fork` + compiled `.cjs` artifact + selftest route.
2. **High** — validator admits mutating CTEs → AST walk for both dialects; rejects DML/DDL/control nodes anywhere in tree.
3. **High** — publish readiness accepts unvalidated hidden datasets → server runs canonical solution against hidden schema before persist; 422 on mismatch.
4. **Medium** — MCP readiness pollutes reveal audit log → split `/hidden-data/status` route returning presence-only without audit row.

### Pass 3 (against the revised Phase 2 plan, 2026-05-25) — 4 findings, all folded into `e66c373`
1. **High** — hidden-data routes collide with existing `[slug]` admin route in Next App Router → renamed everything to `[slug]` with slug→id lookups.
2. **High** — `hiddenDataValidatedAt` can go stale on edits → added `hiddenDataValidationFingerprint`; existing problem-update route nulls both fields on relevant edits; status endpoint recomputes from current state and flags drift.
3. **Medium** — judge queue can briefly exceed concurrency cap → slot-reserving queue; no transient free state; regression test asserts the bound.
4. **Medium** — SimHash overflows Postgres BIGINT signed range → `simhash` column is now `String` (hex), not `BigInt`.

A fourth Codex pass was not run. Pass 3's findings were already in the medium severity range and largely correctness rather than security; further passes are likely diminishing returns.

## Phase 2 plan structure (14 tasks)

| # | Task | Risk |
| --- | --- | --- |
| 1 | Schema additions (ContestVerdict + ContestSubmission/Solve/Leaderboard/AdminAuditLog + simhash:String + validation tracking) | Low — additive. |
| 2 | SQL function denylist (pure data) | Low. |
| 3 | **AST-based SQL validator** (DuckDB via `json_serialize_sql`; Postgres via `libpg-query`) | High — load-bearing security. AST tag names need verification at execution time. |
| 4 | DuckDB + PGlite engine runners with locked-down config | Medium. |
| 5 | **Child-process worker + slot-reserving queue + production selftest** | High — security trust root + production-build verification gate. |
| 6 | **Escape-attempt regression corpus** | High — must be green on every CI run. |
| 7 | AdminAuditLog helper | Low. |
| 8 | **Admin hidden-data routes (reveal/PUT/status) with canonical-solution validation + fingerprint** | High — every contestant verdict depends on this being correct. |
| 9 | **Transactional submit pipeline** with DB-backed idempotency + hard-PK first-solve uniqueness | High — the rating-trust invariant. |
| 10 | POST /api/contests/[slug]/submit endpoint | Medium. |
| 11 | GET /api/contests/[slug]/status (server-clock drift correction) | Low. |
| 12 | MCP `set_problem_hidden_dataset` | Low — thin wrapper over PUT. |
| 13 | MCP `publish_contest` (uses `/status`, never `/reveal`) | Low. |
| 14 | Roadmap update + PR | Low. |

## Items intentionally deferred (called out in plan + PR template)

1. **Per-user submit rate limit** — spec §11.4. Phase 7 anti-cheat work.
2. **`isOrderedComparison` field on `SQLProblem`** — Tasks 8 and 9 read it. Verify before execution; if absent, add as a one-line schema change at the top of Task 1 or treat all comparisons as unordered for v1.
3. **Real SimHash implementation** — Phase 2 stores a deterministic hex hash placeholder. Phase 7 replaces with the token-normalized version.
4. **AST tag-name verification** — Task 3 Step 6 calls out that DuckDB and `libpg-query` AST shapes need a one-time dry-run print to confirm the `*_STATEMENT` / `*Stmt` constants are spelled correctly. The walker logic is correct regardless; only the tag literals need adjustment.

## Suggested next actions

1. **Fix branch hygiene** (5 min) — split the 6 contests doc commits onto `docs/contests-spec-and-plans` so the MCP redaction fix can finally ship as its own PR. Commands in the 2026-05-24 handoff.

2. **Push and open a docs PR** for the spec + both plans before Phase 2 implementation starts. PR body should highlight the three Codex passes as the rigor signal.

3. **Verify the deferred items** before starting Task 1: in particular, does `SQLProblem.isOrderedComparison` exist? `grep -n "isOrderedComparison\|ordered" prisma/schema.prisma` will answer in one shot.

4. **Start executing Phase 2.** The user has been undecided on subagent-driven vs inline mode for both phases — Phase 1 was executed externally and came back as PR #145. Repeating that workflow is the path of least resistance. If subagent-driven in this session is preferred, ask before kicking off.

5. **Update the spec to mention `hiddenDataValidationFingerprint`** — added during Phase 2 plan revisions, not in §3.4 of the spec. Non-blocking; one-line edit.

## Files I did NOT touch this session

- No code files modified. All deliverables are documentation under `docs/superpowers/`.
- `prisma/schema.prisma` unchanged.
- `docs/ROADMAP.md` unchanged.

## Time spent

Two focused sessions: Phase 2 plan first, then two Codex revision rounds. No deep code exploration was required; the plan is the artifact.
