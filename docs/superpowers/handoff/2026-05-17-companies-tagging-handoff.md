# Handoff — Companies tagging (V18) + loose ends

**Date:** 2026-05-17
**From:** Claude session that shipped v0.4.10 (tag-discovery)
**For:** the next AI / engineer picking this up

## TL;DR

v0.4.10 (tag-based problem discovery) just shipped to production and is verified live. The user picked **V18 Companies tagging** as the next feature, approved the plan, and is low on tokens — your job is to execute that plan. The plan is self-contained at `docs/superpowers/plans/2026-05-17-companies-tagging.md` — **read it first**.

You should also pick up one small loose end (a helper script in the working tree) before starting V18 — see "Working tree state" below.

## Current state (read this before touching anything)

- **Branch:** `feat/tag-discovery` — confusingly still checked out locally. The PR for this branch (#106) already merged. **Switch off it before starting new work.**
- **Main:** has v0.4.10 commits (#106 tag-discovery, #101 deps × 12, #107 mcp-server deps × 3, #64 eslint 9→10).
- **Production:** `v0.4.10` (commit `34658f6`), deployed 2026-05-17 06:53:58 UTC. Health endpoint returns `{ok:true}`. https://www.learndatanow.com/api/health
- **Working tree (uncommitted):**
  - `M package.json` — adds `audit:tags:prod` script line.
  - `?? scripts/audit-tags-prod.sh` — new helper to run `audit-tags.ts` against prod with a `PROD_DATABASE_URL` env var.
  - `?? docs/superpowers/plans/2026-05-17-companies-tagging.md` — the plan you'll execute.
  - `??` the rest (`.codex/*`, `AGENTS.md`, `.claude/scheduled_tasks.lock`) — **pre-existing, not yours, leave alone**.

## What to do, in order

### Step 1 — Land the audit-tags-prod helper (10 min)

Existing in working tree. Tiny chore PR, gets it out of the way before V18:

```bash
git checkout main && git pull
git checkout -b chore/audit-tags-prod-helper
git add scripts/audit-tags-prod.sh package.json
git commit -m "chore(scripts): add audit:tags:prod wrapper for read-only prod audit"
git push -u origin chore/audit-tags-prod-helper
gh pr create --base main --title "chore(scripts): audit:tags:prod helper" --body "Thin wrapper that runs scripts/audit-tags.ts against a PROD_DATABASE_URL with a localhost foot-gun guard. Scoped to a single process so prod URL doesn't leak into the caller's shell. Follows the same pattern as scripts/sync-from-prod.sh."
```

CI is just lint/typecheck — no e2e needed for a script-only change. Merge when green.

### Step 2 — Execute the Companies tagging plan

**Read `docs/superpowers/plans/2026-05-17-companies-tagging.md` end-to-end before writing any code.** It has:
- Schema migration (one column: `Tag.kind`)
- File-by-file plan with specific paths
- Approved decisions (Companies above Topics; launch gate ≥ 5 × ≥ 3)
- Concrete launch-gate code in the page-render section
- Test plan (unit + e2e)
- Editorial workflow (separate from code — out of scope for the PR)

Branch name: `feat/companies-tagging`. Base: `main`. Ships as **v0.4.11**.

**Approach this with TDD** — same pattern the previous session used for tag-discovery. Look at `scripts/test-tag-discovery.ts` as the reference (creates real DB rows with a unique prefix, asserts, cleans up). Wire the new test into `package.json` and `.github/workflows/test.yml` as a CI step — the existing pattern is right there.

## Quality bar (the user is strict on this)

- **TDD: write failing test first, watch it fail, then implement.** Don't take shortcuts. The previous session followed this religiously and it caught real bugs.
- **No emoji in code or commits** (CLAUDE.md rule).
- **PRs target `main`** with `--base main` — **never** target the default `production` branch directly. The CLAUDE.md spells this out as a hard rule.
- **Don't merge a PR without telling the user.** The previous session's biggest scar was PR #99 auto-merging with red CI and shipping broken engine init to production. Wait for explicit approval before any merge of feature PRs. Dependabot PRs after green CI are OK.
- **`next build` requires `--webpack`** — already pinned in `package.json`. Don't drop the flag.
- **No `--no-verify` ever.** No `git push --force` to anything. CLAUDE.md spells these out.
- **For UI changes, smoke-test in a real browser** (or `next start` + curl, like the previous session did) before reporting done. Type-check passing ≠ feature working.

## Useful commands

```bash
# Local dev
npm run dev                                    # next dev (Turbopack OK)
npm run build                                  # next build --webpack
npx tsc --noEmit                               # typecheck

# Migration after adding Tag.kind
npx prisma migrate dev --name add_tag_kind     # creates + applies migration

# Tests
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:tag-discovery                   # existing — must still pass
DATABASE_URL='...' npm run test:companies-tagging   # new — you'll add this

npx playwright test tests/e2e/tags.spec.ts     # existing — must still pass
npx playwright test tests/e2e/companies-tags.spec.ts # new

# Audits (read-only, safe)
npm run audit:tags                             # local DB
npm run audit:dialects:ci                      # confirms all (problem,dialect) pairs still pass

# After landing chore PR from Step 1
PROD_DATABASE_URL='<neon-pooler-url>' npm run audit:tags:prod
```

## Open follow-ups (NOT in scope for V18 PR)

- **Production tag audit** — once the helper from Step 1 is on `main`, run `npm run audit:tags:prod` against the real production Neon DB and confirm no duplicate/casing-variant tags exist (created by MCP authoring earlier). Local audit was clean (8 tags, no dupes); prod has more tags from MCP and hasn't been audited.
- **v0.5.0 cleanup release** — drop legacy `SQLProblem.solutionSql` and `SQLProblem.expectedOutput` columns (per-dialect maps `solutions`/`expectedOutputs` are the source of truth). Two-PR sequence: code refactor first (ships as v0.4.x), then column-drop migration (ships as v0.5.0). Don't bundle with V18.
- **Editorial pass** for V18 — after the code PR merges, the user (or an MCP-driven flow) needs to actually create the 15 company tags and attach them to existing problems. Code ships dark; launch gate keeps the UI hidden until editorial catches up. See plan §"Editorial workflow".
- **Branch protection** — mark `e2e` as a required status check in repo settings (Settings → Branches → main). Lesson from the #99 incident. Repo-admin click, not code.

## Where to ask if stuck

- `CLAUDE.md` (project root) — the source of truth for conventions. Read it.
- `docs/TECHNICAL_DESIGN.md` — architecture overview, useful when changes feel cross-cutting.
- `.github/CONTRIBUTING.md` — branch/commit/PR/release conventions in detail.
- The user is `@anchitgupt` — they're around but token-limited. Ping them via the conversation when you have a real decision to surface, not for routine progress updates.

## Memory access (if your runtime supports it)

The previous session's persistent memory lives at:
`/Users/anchitgupta/.claude/projects/-Users-anchitgupta-Documents-Github-datalearn/memory/`

There's an indexed `MEMORY.md` plus per-topic markdown files. The user profile, repo conventions, prior feedback, and recent project state are all there. Read `MEMORY.md` first for the index.
