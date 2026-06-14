# Handoff — Contests v1 spec + Phase 1 implementation plan committed (not pushed)

**Date:** 2026-05-24
**From:** Claude session that brainstormed the Contests feature into a full design spec, hardened it through a Codex adversarial review (4 findings folded back in), and wrote a 22-task TDD implementation plan for Phase 1.
**Continues:** prior MCP work on branch `fix/mcp-e2e-redact-key-log` (commit `45eb861`).
**For:** the next AI / engineer.

## TL;DR

1. **Contests v1 design spec landed** — `docs/superpowers/specs/2026-05-24-contests-design.md` (~900 lines). Covers official rated weekly/biweekly contests, user-created custom contests (unrated, invite-only), server-side judging against hidden test cases, Glicko-2 rating, server-authoritative time, social sharing, and a 7-phase rollout.

2. **Codex adversarial review surfaced 4 architectural risks**, all folded into the spec before the plan was written:
   - Double-counting under retries / concurrency → idempotency key + per-attempt uniqueness + a dedicated `ContestProblemSolve` table.
   - `CONTEST_LOCKED` status overload → dropped in favor of a separate `ContestProblemLock` table + `excludeLockedProblems` helper.
   - Shallow sandbox allowlist → replaced with five-layer defense (process isolation, engine config, AST + function denylist, resource bounds, CI escape-attempt corpus).
   - Verdict enum mismatch → dedicated `ContestVerdict` enum, leaving `SubmissionStatus` unchanged.

3. **Phase 1 (Foundation) implementation plan** — `docs/superpowers/plans/2026-05-24-contests-phase-1-foundation.md`, 22 tasks, ~150 TDD steps. Covers schema + admin REST CRUD + audited public surfaces + registration + sweep cron + admin UI + Playwright happy path. **No execution started.**

## ⚠️ Branch hygiene issue

The three contests doc commits (`f072ef8`, `5d08a28`, `b71f7c0`) are stacked on top of `fix/mcp-e2e-redact-key-log` (the prior MCP API key redaction work — single commit `45eb861`). They are **unrelated** to that branch and should not ship as part of that PR.

Recommended cleanup before pushing anything:

```bash
# Park the MCP fix on its own branch (it already is — that's the branch name)
# then move the contests commits to a new branch off main.
git switch -c docs/contests-spec-and-plan
git reset --hard b71f7c0
git switch fix/mcp-e2e-redact-key-log
git reset --hard 45eb861   # drops the contests commits from this branch
# Confirm the MCP redaction commit is intact, then push it as its own PR.
```

Or: cherry-pick. Either way, **do not push `fix/mcp-e2e-redact-key-log` until the contests commits are off it.**

## Where things stand

### Production
- v0.6.1 hotfix shipped 2026-05-23 (workspace tabs layout fix). v0.6.2 release for DuckDB console noise was the next pending action per prior memory; status unknown this session.

### `main`
- HEAD includes the MCP v0.8.0 + v0.7.0 work (commits `8369197`, `716de97`, etc.). No new release PR to `production` opened this session.

### Local branch (not pushed)
- **`fix/mcp-e2e-redact-key-log`** — 3 commits ahead of origin (see branch hygiene issue above):
  - `45eb861` — fix(mcp): redact e2e api key cleanup log  ← the legitimate branch content; one-line MCP fix
  - `f072ef8` — docs(spec): contests v1 design  ← belongs on its own branch
  - `5d08a28` — docs(spec): contests — address Codex adversarial review  ← same
  - `b71f7c0` — docs(plan): contests Phase 1 foundation implementation plan  ← same

### Open PRs (project-wide)
- Not surveyed this session. `gh pr list` for current state.

## Documents produced this session

| Path | Lines | Purpose |
| --- | --- | --- |
| `docs/superpowers/specs/2026-05-24-contests-design.md` | ~900 | Full contests design — data model, hidden-test judge, Glicko-2, locking, rating, social, security, phasing (1→7). Battle-tested through one Codex adversarial pass. |
| `docs/superpowers/plans/2026-05-24-contests-phase-1-foundation.md` | ~2,687 | 22-task TDD plan for Phase 1 only. Each task has files-to-touch, code blocks, tests, and commits. |
| `docs/superpowers/handoff/2026-05-24-contests-spec-and-plan-handoff.md` | this file | Handoff. |

## Key decisions baked into the spec

- **Custom contests are always unrated.** Collusion in a friend group is undetectable in v1, so they cannot affect Glicko state regardless of payload.
- **Hidden test cases require server-side judging.** Phase 1 only adds the *schema* fields; the judge service is Phase 2 and blocks all rated functionality.
- **Locking lives in its own table** (`ContestProblemLock`) — does not overload `ProblemStatus`. Public surfaces opt in via `excludeLockedProblems(where)`. Custom-curated lists keep locked rows visible with "Locked: in contest until …" instead of silently shrinking.
- **Glicko-2 with tournament treatment** — each rated participant gets a multi-opponent update against every other rated participant in the same contest, applied in one transaction at FINALIZE.
- **Server-authoritative time** — client clock is display-only. Submit guards compare `new Date()` server-side; `acceptedAt` is stamped server-side; client renders a drift-corrected countdown that re-snaps every 30s.
- **Idempotency is DB-backed**, not in-memory. `ContestSubmission.idempotencyKey` has a unique constraint per `(contestId, userId)`. First-solve uniqueness is enforced by a separate `ContestProblemSolve` table with a hard PK on `(contestId, userId, problemId)`.

## Phasing — what's planned vs what's planned-out

| Phase | Spec? | Plan? | Status |
| --- | --- | --- | --- |
| 1 — Foundation (schema, lock, admin CRUD, listing, registration) | ✅ | ✅ | Plan written, not executed |
| 2 — Server-side judge (sandboxed DuckDB, hidden-data routes, submit endpoint) | ✅ | ❌ | Write the plan next |
| 3 — Runtime (in-contest workspace, drift timer, incremental scoring, polling leaderboard) | ✅ | ❌ | |
| 4 — Rating (Glicko-2, finalize job, profile rating card) | ✅ | ❌ | |
| 5 — Custom contests (USER_CUSTOM kind, invite tokens, quotas) | ✅ | ❌ | |
| 6 — Social + sharing (OG image, result page, share tray) | ✅ | ❌ | |
| 7 — Anti-cheat + polish (SimHash, IP clustering, honor-code, Monaco lockdown) | ✅ | ❌ | |

User explicitly chose to plan Phase 1 only; subsequent phases get their own plans after Phase 1 lands.

## Suggested next actions (pick one)

1. **Fix branch hygiene** (5 min) — split the contests commits onto `docs/contests-spec-and-plan` so the MCP redaction fix can ship as its own PR. See commands above.

2. **Push the docs branch + open a documentation PR** so the spec + plan land on `main` before any implementation starts. PR body should link both files and note "implementation PRs to follow Phase 1 plan task-by-task."

3. **Start executing Phase 1.** The user's stated preference at the end of the session was undecided between subagent-driven and inline execution — ask before starting. Subagent-driven is the recommended option (one subagent per task, review checkpoints).

4. **Write the Phase 2 plan** before starting any implementation, so the engineer building the judge has the full TDD breakdown in hand. Phase 2 is the largest and riskiest phase — its plan deserves its own Codex adversarial pass.

## Open questions the spec parks for follow-up

These are §15 of the spec — not blockers for Phase 1 but worth deciding before later phases:

1. **Postgres-dialect judge engine** — PGlite (in-process WASM) vs ephemeral Neon branch. Spec leans PGlite.
2. **Country flag on leaderboard** — requires a `User.country` field that doesn't exist; spec defers.
3. **Friends filter on leaderboard** — needs a friend graph; spec defers, shows disabled with tooltip.
4. **Vercel Cron cadence** — current plan is Hobby (no cron). Either upgrade for Phase 1's sweep endpoint or document manual trigger as the gap.
5. **Email notifications** — separate spec; not blocking contests v1.

## Files I did NOT touch this session

- No code files were modified. All changes are documentation under `docs/superpowers/`.
- `prisma/schema.prisma` is unchanged. The schema additions are described in the spec/plan but no migration has been run.
- `docs/ROADMAP.md` is unchanged. Plan Task 22 updates it after Phase 1 ships.

## Time spent

Approximately one focused session. No deep code exploration was required; the spec is the artifact.
