# Handoff — end of May 17/18 session

**Date:** 2026-05-19
**From:** Claude session that shipped v0.4.10 → v0.4.11 → v0.4.12 across May 17/18, plus the MCP tooling cleanup
**For:** the next AI / engineer picking this up

## TL;DR

Three feature releases shipped end-to-end in one day. Companies tagging (V18) and Tracks (V9) both live on production with editorial content seeded. MCP server now logs its build SHA on stderr so the recurring "stale bundle" footgun is permanently visible. Nothing on fire; all open PRs from this push are closed except one dependabot.

Next AI: read this file first, then `docs/ROADMAP.md`, then `CLAUDE.md`. The most valuable context not in those is in the "Footguns we caught" section below — don't relearn them.

## Where things stand (snapshot)

- **Local branch:** `main`, clean except for the untracked notes in the working tree (`.codex/`, `AGENTS.md`, prior handoffs — pre-existing, leave alone).
- **`main` HEAD:** `1fb9551` (PR #116 merge: MCP track item tools + bundle build-info logging).
- **Production:** `v0.4.12` (commit `5b319e2` for v0.4.12 release; commit `1fb9551` lives only on `main` because MCP changes don't ride to production — they run on the editor's machine).
- **Live learner-facing surfaces:**
  - 53 PUBLISHED problems.
  - 15 company tags (`meta`, `amazon`, `apple`, `netflix`, `google`, `microsoft`, `stripe`, `airbnb`, `uber`, `linkedin`, `doordash`, `snowflake`, `databricks`, `spotify`, `coinbase`). 7 of these qualify the launch gate at `/practice/tags` (uber 17 problems, amazon 10, meta 5, netflix 3, google 3, stripe 3, linkedin 3).
  - 3 PUBLISHED tracks at `/learn/tracks`:
    - `window-functions-deep-dive` (HARD, 6 items)
    - `faang-sql-set` (MIXED, 12 items)
    - `joins-for-data-engineers` (MEDIUM, 9 items)
- **Open PR:** **#117** — dependabot bump `lucide-react 0.562.0 → 1.16.0` (major). Created 2026-05-18, untouched. **Be careful with this one:** lucide-react v1 is a breaking change (icon API changes); review the changelog before merging. Don't blind-merge dependabot major-version PRs.

## What shipped this session

| Release | Feature | Notes |
|---|---|---|
| **v0.4.10** | Tag-based discovery (#106) + 16 dep bumps (#101, #107, #64) | `/practice/tags` index + detail, `TagPill`, `getPublicTags()` / `getProblemsByTag()` |
| **v0.4.11** | Companies tagging V18 (#110) | `Tag.kind: TOPIC \| COMPANY` enum + ≥5×≥3 launch gate. Same PR fixed the nested-`<a>` bug from v0.4.10. |
| **v0.4.12** | Tracks V9 (#112 backend + #113 learner) + docs (#114) | New `Track` / `TrackItem` schema, admin CMS, MCP authoring tools, learner pages. |
| **(no release)** | MCP server hardening (#116) | Track item-management tools + bundle build-info logging. Runs on editor's machine; not deployed to Vercel. |

## Footguns we caught — don't relearn them

These are the ones that cost real time. The fixes are documented in the source but capturing them here saves the next AI from rediscovering them.

### 1. Stale MCP bundle silently drops new tools

**Symptom:** the assistant in Claude Desktop / Claude Code reports a tool missing that's clearly in the source.

**Cause:** Claude Desktop and Claude Code spawn the MCP server as a child process **at host startup**. The child loads `mcp-server/dist/index.js` once and never reloads. Rebuilding the bundle on disk has no effect on the running process. We hit this twice in a single day — once with `kind=COMPANY` on `create_tag`, again with the track item tools.

**Mitigation now in place** (PR #116):
- `mcp-server/src/index.ts` logs to stderr on startup:
  ```
  [datalearn-mcp] bundle <git-sha[-dirty]>, built <iso-time>
  [datalearn-mcp] connected, base=<origin>
  ```
- The host's stderr panel (Claude Desktop's "MCP server logs", Claude Code's session output) shows this immediately. If the SHA doesn't match the latest commit touching `mcp-server/src/`, the bundle is stale — tell the user to fully quit (`⌘Q`) and reopen.
- **Whenever you change `mcp-server/src/**` or `lib/admin-validation.ts`, you MUST rebuild the bundle:** `cd mcp-server && npm run build && cd ..`.

### 2. Nested `<a>` inside `<a>` from row-level Link + TagPill

**Symptom:** Browser hydration warnings: `<a> cannot contain a nested <a>`. Shipped to prod for hours in v0.4.10.

**Cause:** v0.4.10 wrapped each problem row in `/practice` as a `<Link>` (`<a>`). v0.4.10 also added `TagPill` (also a `<Link>`/`<a>`). `stopPropagation` made clicks "work" but the HTML was invalid.

**Fixed pattern (now in `components/practice/PracticeList.tsx`):** the row container is a plain `<li>` with `relative group hover:bg-…`. Only the title is a `<Link>`, with `before:absolute before:inset-0` on it so the title link's `::before` pseudo-element overlays the whole row → full-row clickable. Tag pills are siblings with `relative z-10` so they stay independently clickable above the overlay. No `stopPropagation` needed.

**When adding any future card / row with multiple clickable things,** use this pattern — never nest `<Link>`s.

### 3. `update_problem.tagSlugs` REPLACES, doesn't append

**Symptom:** Attaching a company tag to a problem drops every existing topic tag.

**Cause:** The admin REST API treats `tagSlugs` as the new full tag set, not a delta.

**Always:** call `get_problem` first, read existing `tagSlugs`, include them in the array you send to `update_problem`. Same applies to MCP `update_problem`. The MCP description warns about this; trust it.

### 4. `create_tag` is an upsert by slug

**Symptom:** Today's recovery from "all 15 company tags created as kind=TOPIC". Could have re-created cleanly without a `delete_tag` tool.

**Behavior:** `POST /api/admin/tags` (and MCP `create_tag`) upsert on `slug`. If the slug exists, `name` is updated; `kind` is updated **only when explicitly provided in the body**. This is how we flipped the 15 mistagged tags from TOPIC to COMPANY without a separate UPDATE endpoint.

**Useful for:** correcting metadata on existing tags. **Not a substitute for** a proper `update_tag` MCP tool (which doesn't exist yet — see follow-ups).

### 5. Next 16 streaming RSC returns 200 on `notFound()`

**Symptom:** `/practice/tags/does-not-exist` renders the global `app/not-found.tsx` content (404 page body) but HTTP status is 200.

**Cause:** Next.js 16's streaming RSC commits the status before the React render finishes. By the time `notFound()` throws, headers are already sent.

**Workaround:** E2E tests assert on the body (`page.getByRole("heading", { name: "Page not found" })`) instead of `response.status() === 404`. The existing e2e tests follow this pattern. Don't fight it.

## Quality bar (non-negotiable, from CLAUDE.md and lessons)

- **TDD: write failing test first, watch it fail, then implement.** Reference: `scripts/test-tag-discovery.ts`, `scripts/test-companies-tagging.ts`, `scripts/test-tracks.ts`.
- **PRs target `main`** with `--base main`. **Never** target `production` directly except for a release PR titled `release: v<X.Y.Z>`.
- **Don't merge a PR without telling the user first.** Dependabot PRs after green CI are OK. Feature PRs need explicit "merge" or "ok" approval. The user reinforces this rule with "Don't merge without telling me" — taken seriously.
- **`next build` requires `--webpack`.** Pinned in `package.json`. Turbopack panics on Next 16 with our code shape.
- **No `--no-verify` ever.** No force-push to anything. Branch protection on `main` is intentionally still off — user wants to plan it later. Don't enable it without asking.
- **For UI changes, smoke-test in a real browser** (or `next start` + curl). Type-check passing ≠ feature working. The nested-`<a>` bug shipped because no one loaded the page.
- **Don't write comments that explain WHAT.** Comments explain WHY: past bug, hidden constraint, surprising behavior. Default to no comments.
- **For UI/SSR work, include a `curl … | grep` nested-`<a>` count smoke** — caught the v0.4.10 hydration bug pattern. See PR #110 fix commit.

## Useful commands

```bash
# Local dev
npm run dev                                    # next dev (Turbopack OK)
npm run build                                  # next build --webpack
npx tsc --noEmit

# Migrations
npx prisma migrate dev --name <name>

# Tests
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npm run test:tag-discovery                   # 9 tests
DATABASE_URL='...' npm run test:companies-tagging    # 7 tests
DATABASE_URL='...' npm run test:tracks               # 11 tests
DATABASE_URL='...' npm run test:duckdb-init
npm run audit:dialects:ci                            # 46/46 pairs

# E2E (against `next start` on port 3100)
npx playwright test tests/e2e/<spec>.spec.ts

# Production audits
npm run audit:tags                                   # local DB
PROD_DATABASE_URL='<neon-pooler>' npm run audit:tags:prod

# MCP rebuild + smoke
cd mcp-server && npm run build && cd ..
DATALEARN_API_KEY=x DATALEARN_BASE_URL=http://localhost:9999 \
  node mcp-server/dist/index.js < /dev/null 2>&1 | head -2
# Expect:
#   [datalearn-mcp] bundle <sha>, built <iso>
#   [datalearn-mcp] connected, base=http://localhost:9999

# Production health
curl -s https://www.learndatanow.com/api/health
```

## Open follow-ups, no urgency

Queued from this session; user has not committed to a specific next sprint:

1. **PR #117 — lucide-react 0.562.0 → 1.16.0 (major).** Open since 2026-05-18. **Don't auto-merge.** Lucide v1 has icon renames + removed icons. Check the upgrade guide before approving. Test that every `import { ... } from "lucide-react"` in the codebase still resolves.
2. **v0.5.0 cleanup** — drop legacy `SQLProblem.solutionSql` (nullable) + `SQLProblem.expectedOutput` (NOT NULL). Two-PR sequence planned:
   - PR A (`refactor/drop-legacy-dialect-fallback`): code-only, remove fallback reads/writes, tighten Zod to require per-dialect keys. Ships as v0.4.13.
   - PR B (`refactor/drop-legacy-dialect-columns`): Prisma migration drops the two columns. Ships as v0.5.0.
   - Pre-flight: write `scripts/audit-legacy-fallback.ts` to confirm every PUBLISHED problem × dialect has non-empty entries in `solutions` and `expectedOutputs` JSON maps.
3. **`audit:tags:prod`** never run against the real Neon DB. The helper landed via PR #109 but hasn't been exercised. ~30 seconds when you have the prod URL.
4. **Branch protection on `main`** — user explicitly **deferred** ("plan this later"). Don't enable without asking. Scaffolding I gathered for the eventual decision:
   - Required check name should be `e2e`.
   - Other check-runs visible: `Analyze (actions)`, `Analyze (javascript-typescript)`, `Dependabot`, `Vercel Preview Comments`.
   - Current protection: force-pushes blocked, deletions blocked, conversation resolution required, but **no required status checks**.
5. **Task #59 — Learn v2 ByteByteGo-format support.** Long-deferred. Visual-heavy article format.
6. **Track item-management `update_track.items[]` shortcut.** Today's editorial pass attached items one call at a time (`add_track_item` × N). For larger tracks (20+ items) this is tedious. A `set_track_items(slug, [problemSlug, ...])` MCP tool that does atomic add-or-replace would be a nice ergonomic win.
7. **Bundle freshness check script** (bonus item from task #103) — `mcp-server/scripts/check-bundle-fresh.sh` that compares the bundle's embedded `BUILD_TIME` against the latest commit touching `mcp-server/src/`. Optional; the startup log line already covers most cases.
8. **Cover image strategy for tracks** — v0.4.12 ships with raw `<img>` for cover URLs (admin pastes a URL). Trade: skips next/image optimization. Worth revisiting once we have ≥10 tracks and want a curated cover-art pipeline.

## Decisions the user has made (don't relitigate)

- **AI hints (V14)** — parked. User explicitly said "I will park till other things are done" when prioritizing. Don't propose it as next-up.
- **Profile/streaks** — already exists. Don't propose building it; it's done.
- **Companies above Topics on `/practice/tags`** — approved decision, baked into the page render order.
- **Launch gate strictness** (≥5 × ≥3) — approved decision, enforced server-side.
- **Tracks: PROBLEMS-only items in v1** — approved. Article items deferred to v1.5.
- **Tracks: computed progress, no `UserTrackProgress` table** — approved.
- **Tracks: admin-only authoring** — approved (mirrors Topic, not Tag).
- **Tracks: no profile integration in v1** — approved.
- **Branch protection deferred** — user wants to plan it later.

## Reference docs (read before coding)

- `CLAUDE.md` (project root) — conventions source of truth.
- `docs/ROADMAP.md` — what's shipped, what's deferred, what's vision. Up to date through v0.4.12.
- `docs/TECHNICAL_DESIGN.md` — architecture overview.
- `.github/CONTRIBUTING.md` — branch / commit / PR / release conventions.
- `docs/superpowers/plans/2026-05-16-tag-based-discovery.md` — v0.4.10 plan, shipped.
- `docs/superpowers/plans/2026-05-17-companies-tagging.md` — v0.4.11 plan, shipped.
- `docs/superpowers/plans/2026-05-17-study-plans-tracks.md` — v0.4.12 plan, shipped.
- `docs/superpowers/handoff/2026-05-17-companies-tagging-handoff.md` — companies-tagging handoff, historical.
- `docs/superpowers/handoff/2026-05-17-tracks-handoff.md` — tracks handoff, historical.
- `docs/superpowers/handoff/2026-05-19-end-of-day-handoff.md` — this file.

## How to ask the user

- They're `@anchitgupt`. Direct, decisive, prefers terse responses. Pings with single-word approvals ("ok", "done", "merge"). Don't pad.
- They explicitly want "no interruptions" for the actual build phase of a feature. Surface only the load-bearing decisions before code, then go heads-down. Don't ping for routine progress.
- They check work in the IDE — if they make manual edits, treat those as intentional unless the diff looks wrong.
- The Custom Instructions for their Claude Desktop project are in the prior session — paste-ready prompt that documents conventions for editorial AI sessions. Same one applies.

## Memory access

`/Users/anchitgupta/.claude/projects/-Users-anchitgupta-Documents-Github-datalearn/memory/`. `MEMORY.md` is the index. Read it first if your runtime supports memory loading.
