# Handoff — Study plans / Tracks (V9)

**Date:** 2026-05-17
**From:** Claude session that shipped v0.4.10 (tag-discovery) and v0.4.11 (companies tagging)
**For:** the next AI / engineer picking this up
**Plan to execute:** `docs/superpowers/plans/2026-05-17-study-plans-tracks.md` (287 lines — **read it first end-to-end**)

## TL;DR

The user has approved Tracks (V9) as the next sustained build. They explicitly want a feature they can park you on with no interruptions, so plan to work heads-down for 1.5-2 weeks and only surface for the two "Open decisions" called out in the plan.

Companies-tagging (v0.4.11) just shipped end-to-end (code + editorial pass). Production is at `v0.4.10` git-describe but actually serving v0.4.11 (commit `5b319e2`); release tag pushed. Profile/streaks already exist. Don't propose them as next steps.

## Current state (read before touching anything)

- **Branch:** `feat/companies-tagging` — confusingly still checked out locally. The PR for this branch (#110) already merged. **Switch off it before starting new work** — create `feat/tracks` from a fresh `main`.
- **Main HEAD:** `b64063c` (merge of #110). Production HEAD: `5b319e2` (`v0.4.11`). Released: 10:17 UTC today.
- **Live taxonomy** (verified earlier today on `https://www.learndatanow.com/practice/tags`):
  - 7 companies hit the launch gate (uber 17 problems, amazon 10, meta 5, netflix 3, google 3, stripe 3, linkedin 3) — Companies section visible.
  - Topics still present.
- **Working tree (uncommitted) that's yours to ignore or roll up:**
  - `docs/superpowers/plans/2026-05-17-study-plans-tracks.md` (the plan you're executing)
  - `docs/superpowers/handoff/2026-05-17-tracks-handoff.md` (this file)
  - `docs/superpowers/handoff/2026-05-17-companies-tagging-handoff.md` (prior handoff, leave alone)
  - `.codex/*`, `AGENTS.md`, `.claude/scheduled_tasks.lock` — **pre-existing, not yours, leave alone**.

## What to do, in order

### Step 0 — Branch off main

```bash
git checkout main && git pull
git checkout -b feat/tracks
```

Anything in the working tree from `feat/companies-tagging` will follow — that's fine, the plan + handoff docs are intended to live alongside the implementation commits.

### Step 1 — Read the plan

`docs/superpowers/plans/2026-05-17-study-plans-tracks.md`. Crucial sections:

- **Approved decisions** (top): 5 defaults the user signed off on (problems-only items v1, no hard sequencing gate, computed progress with no `UserTrackProgress` table, admin-only authoring, no profile integration v1). Don't relitigate unless you find a blocker.
- **Schema:** `Track` + `TrackItem` Prisma models. Migration name: `add_tracks`.
- **Sequencing within the feature branch** (bottom): 8-commit order. Follow it — each commit independently builds and typechecks.
- **Open decisions** (bottom): two cosmetic ones (cover image required vs optional with gradient fallback; track tagging in v1 vs deferred). Surface these to the user *before* writing the UI commits (commits 4 + 6 in the sequence) — not blocking on schema or actions work.

### Step 2 — Execute the 8-commit sequence

From the plan's "Sequencing within the feature branch" section:

1. Schema + migration
2. Actions (`actions/tracks.ts`) — **TDD: tests first, watch fail, implement**
3. Admin REST endpoints
4. Admin UI pages
5. MCP server tools (`mcp-server/src/tools/tracks.ts`) — see "MCP bundle gotcha" below
6. Learner-facing pages
7. E2E spec + CI wiring
8. ROADMAP update

Each commit should typecheck and build cleanly on its own. The natural PR boundary is **between commits 5 and 6** — commits 1-5 ship dark as PR 1, commits 6-7 reveal the feature as PR 2. The user's preference is to ship as two PRs to minimize review surface, but bundle is fine if PR 1 is small.

## Quality bar (the user is strict — non-negotiable)

- **TDD: write failing test first, watch it fail, then implement.** Reference: `scripts/test-tag-discovery.ts` and `scripts/test-companies-tagging.ts`. The previous session followed this religiously and it caught real bugs. **Don't skip — the user will catch it.**
- **No emoji in code or commits** (CLAUDE.md rule).
- **PRs target `main`** with `--base main`. **Never** target the default `production` branch directly — that ships unfinished work. CLAUDE.md spells this out as a hard rule.
- **Don't merge a PR without telling the user first.** The previous session's biggest scar was PR #99 auto-merging with red CI and shipping a broken engine init. Wait for explicit approval. Dependabot PRs after green CI are OK.
- **`next build` requires `--webpack`** — already pinned in `package.json`. Don't drop the flag.
- **No `--no-verify` ever.** No `git push --force` to anything.
- **For UI changes, smoke-test in a real browser** (or `next start` + curl, like the previous session did) before reporting done. Type-check passing ≠ feature working.
- **Trust internal code; only validate at boundaries.** Don't add defensive null-checks where the type system already says it's safe. Don't add try/catch around code that can't throw.
- **Don't write comments that explain WHAT.** Names should do that. Comments explain WHY when the why isn't obvious — past bug, hidden constraint, surprising behavior. Default to no comments.

## MCP bundle gotcha (real, just bit the user)

The MCP server is a separate package (`mcp-server/`) bundled with tsup. Claude Desktop loads `/Users/anchitgupta/Documents/Github/datalearn/mcp-server/dist/index.js` — see `~/Library/Application Support/Claude/claude_desktop_config.json`.

**Whenever you change `mcp-server/src/**` or anything in `lib/admin-validation.ts` that the MCP imports, you MUST rebuild the bundle:**

```bash
cd mcp-server && npm run build && cd ..
```

The bundle is gitignored-ish (it's in `mcp-server/dist/`). If the user reports MCP behavior that doesn't match your source code, the bundle is stale — rebuild + tell them to fully quit Claude Desktop (`⌘Q`, not just close the window) and reopen. This already cost us an hour today; don't repeat.

## Useful commands

```bash
# Local dev
npm run dev                                    # next dev (Turbopack OK)
npm run build                                  # next build --webpack
npx tsc --noEmit                               # typecheck

# Migration
npx prisma migrate dev --name add_tracks       # apply

# Tests (new ones you'll add)
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:tracks                          # new — you'll wire this

# Regression tests (must still pass on your branch)
DATABASE_URL='...' npm run test:tag-discovery
DATABASE_URL='...' npm run test:companies-tagging
DATABASE_URL='...' npm run test:duckdb-init
npm run audit:dialects:ci

# E2E
npx playwright test tests/e2e/tracks.spec.ts   # your new spec

# MCP rebuild + smoke
cd mcp-server && npm run build && cd ..
npm run mcp:e2e-test                           # extend to cover track tools

# Audits (read-only, safe)
npm run audit:tags                             # local DB
PROD_DATABASE_URL='...' npm run audit:tags:prod
```

## Where the patterns live (read these before coding parallel structures)

- **Schema/actions/MCP for editorial entities:** Topic (admin-only) and Tag (admin + MCP). Topic is closer to Track in spirit (admin-only, editorial).
  - `prisma/schema.prisma` — `Topic`, `Tag`, `Article`
  - `actions/topics.ts` — server action shape
  - `app/api/admin/topics/route.ts` + `[slug]/route.ts` — REST shape
  - `app/admin/topics/page.tsx` — admin index
  - `mcp-server/src/tools/topics.ts` — MCP tool shape
- **Ordered-item list with reorder:** ProblemList + ProblemListItem (private to users, but the *reorder mechanics* are the same pattern).
  - `prisma/schema.prisma` — `ProblemList` + `ProblemListItem` w/ `@@unique([listId, position])`
  - `actions/lists.ts` — `reorderList` is exactly what `reorderTrack` should look like
  - `components/lists/ListDetail.tsx` — UI for reorder
  - `components/lists/AddProblemsPicker.tsx` — search-and-add picker; reuse for track item add
- **Learner-facing list-and-detail with progress:** `/learn/[topicSlug]/[articleSlug]` for "next/prev within topic" mechanic; `/practice/tags/[slug]` for the filtered-list pattern.

**Don't reinvent.** Pattern-match these aggressively. The codebase is consistent on purpose.

## Open follow-ups (NOT in scope for Tracks PR)

- **v0.5.0 cleanup** — drop legacy `SQLProblem.solutionSql` and `expectedOutput` columns. User explicitly parked this ("will pick this up later") — don't include it in the Tracks branch.
- **AI hints (V14)** — parked per user decision. Don't propose.
- **V18 follow-ups** — user-reported attribution form, inline Companies dropdown filter, brand-alias redirects (Facebook → Meta). Documented in the V18 plan's "Deferred to v2" section.
- **MCP bundle versioning / hot-reload** — proposed earlier as a footgun-prevention follow-up. User didn't pick it up. Consider proposing again after Tracks PR 1 if it would help editorial workflow.
- **Branch protection** — mark `e2e` as required status check in repo Settings to prevent auto-merge with red CI. Not coding; repo-admin click. Lesson from the #99 incident.
- **Editorial seed for V9** — after PR 2 ships, the user (or you via MCP-driven prompt) needs to seed 3 starter tracks. Pattern is the same as the V18 editorial pass.

## Where to ask if stuck

- `CLAUDE.md` (project root) — conventions source of truth. Read it.
- `docs/TECHNICAL_DESIGN.md` — architecture overview.
- `.github/CONTRIBUTING.md` — branch/commit/PR/release conventions.
- `docs/superpowers/handoff/2026-05-17-companies-tagging-handoff.md` — the prior handoff has more on quality bar, useful commands, and CLAUDE.md gotchas. Most of it applies to Tracks too.
- The user is `@anchitgupt`. They're around but token-limited and have explicitly asked for an uninterrupted build. **Only surface the two "Open decisions"** (cover image v1, track tagging v1) before drawing the UI. Don't ping for routine progress.

## Memory access

Persistent memory lives at:
`/Users/anchitgupta/.claude/projects/-Users-anchitgupta-Documents-Github-datalearn/memory/`

`MEMORY.md` is the index. Read it first if your runtime supports memory loading.
