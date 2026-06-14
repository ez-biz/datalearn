# Handoff — CSP hotfix open, curriculum v1 spec/plan committed, implementation queued

**Date:** 2026-05-22
**From:** Claude session that diagnosed two production-impacting bugs (figure 404, mermaid blank), brainstormed the v1 curriculum end-to-end, and committed the spec + 20-task implementation plan.
**Continues:** `docs/superpowers/handoff/2026-05-21-learn-v2-launch-handoff.md`.
**For:** the next AI / engineer.

## TL;DR

Followed up the Learn v2 launch with two parallel tracks:

1. **Diagnosed + opened a production hotfix.** The `/learn/window-functions/first-look-at-window-functions` article showed a broken-image icon + dumped alt text inside a `:::figure` block; root cause was the LLM author inventing a `/learn/img/window-vs-groupby.svg` path that doesn't exist on disk, and the Layer 2 publish validator skipping `/learn/**` paths from existence checks. While diagnosing, also identified that **mermaid charts on every Learn page never render in production** — mermaid 11 uses `new Function("return this")` for its globalThis polyfill, which the v0.5.0 CSP (no `'unsafe-eval'`) silently blocks. Same CSP also blocks Google Analytics + Vercel Analytics. **PR #124 open** combining unsafe-eval + analytics CDN allowlist into one v0.5.0.2 hotfix.

2. **Brainstormed the v1 curriculum end-to-end and committed the spec + plan.** Five multi-choice questions locked the shape (mixed audience, evergreen tool-agnostic, two lanes, spine-first, asymmetric granularity). Spec defines 10 topics across 2 lanes, 12 articles (7 new + 5 refreshed), per-article skeleton (1200–3000 words, diagram-first), `Topic.lane` + `Topic.displayOrder` schema migration, ~28 concept tags, new MCP `update_topic` tool, and a full rewrite of the author prompt that closes the figure-404 footgun at the source. **PR #125 open** with spec + 20-task implementation plan. Implementation broken into three independent sub-PRs; branch for PR 1 (validator hardening) already cut but no work yet committed.

**Critical realization mid-brainstorm:** `Article.relatedProblems` (M-M with SQLProblem) and `Article.tags` (M-M with Tag) — the two MCP enhancements the user originally asked for — were **already shipped end-to-end in v0.5.1** (PR #122). The user didn't realize. The curriculum-v1 work surfaces them via the new author prompt and adds the missing ordering primitives (`Topic.lane`/`displayOrder`).

## Where things stand

### Production
- Tag `v0.5.0` still live (commit `c1df4ae`).
- **Two known production issues confirmed:**
  - Mermaid charts on `/learn/**` never render (CSP blocks `Function()` constructor). Affects `joins/how-a-join-works` and `window-functions/first-look-at-window-functions`. PR #124 fixes.
  - Analytics dark on `/learn/**` (carryover from prior handoff). PR #124 fixes.
  - Window-functions figure 404 (user manually swapped the broken `:::figure` block to a `:::mermaid` earlier today — confirmed by user message "for now `:::figure` replacement I have handled"). Once PR #124 ships, the swap will actually render.

### Open PRs
- **#124** `fix/learn-csp-mermaid-analytics` — CSP hotfix (mermaid + analytics). Awaits CI + review + merge. Title: "fix(learn): allow unsafe-eval + analytics CDNs in /learn CSP". Locks `unsafe-eval`, `googletagmanager.com`, `vercel-insights.com` etc. into `tests/e2e/learn-csp.spec.ts` assertions so future re-tighten passes can't regress silently.
- **#125** `docs/learn-curriculum-spec` — spec + 20-task plan. Doc-only. Awaits stakeholder review. Title: "docs: Learn curriculum v1 spec + infrastructure plan".

### Local state to pick up
- **Branch cut, no commits yet:** `fix/article-publish-validator-learn-asset-existence`. Created off main. The plan's Task 1 is queued to run on it.
- **Active session was at TaskCreate stage for plan execution** when user typed "handoff". Subagent-driven-development skill was loaded and tasks 7–10 (plan tasks 1–4) were created in TodoWrite. Task #7 marked in_progress but no implementer dispatched.
- **Carryover from prior handoff:** stashed `.env*.local` gitignore change still in `git stash list`; pre-existing untracked `.claude/scheduled_tasks.lock`, `.codex/`, `AGENTS.md`, `docs/superpowers/handoff/`.

## What shipped this session

| Artifact | Where | What |
|---|---|---|
| PR #124 | `fix/learn-csp-mermaid-analytics` | CSP allowlist expansion: `'unsafe-eval'` for mermaid, `googletagmanager.com` + `*.google-analytics.com` + `*.vercel-scripts.com` + `*.vercel-insights.com` in script-src/connect-src/img-src as appropriate. Strengthened `tests/e2e/learn-csp.spec.ts` to assert all three new allowances. |
| Curriculum spec | `docs/superpowers/specs/2026-05-22-learn-curriculum-design.md` | 275 lines. Defines lanes, 10 topics, 12 articles, per-article skeleton (1200–3000 words, diagram-first, 10 mandatory blocks), Topic schema migration, ~28 concept tags, MCP tool additions, full author prompt rewrite, paired v0.5.0.2 validator fix. |
| Curriculum infrastructure plan | `docs/superpowers/plans/2026-05-22-learn-curriculum-infrastructure.md` | 1670 lines. 20 tasks across 3 PRs (validator hardening → topic lanes/MCP/UI/seeds → prompt rewrite). Each task has exact file paths, complete code blocks, verifiable commands. |
| PR #125 | `docs/learn-curriculum-spec` | Spec + plan together. Doc-only. |

## Decisions locked this session (don't relitigate)

- **Audience:** mixed — interview prep + career switcher. (`/learn/advanced` for practicing engineers is a future lane.)
- **Scope:** tool-agnostic, evergreen. No Spark / dbt / Airflow / Snowflake / BigQuery articles.
- **Structure:** two lanes — `SQL` and `DATA_ENGINEERING`.
- **Volume:** spine-first. ~10 topics × ~1 pillar article in v1.
- **Topic granularity:** asymmetric — SQL lane has 6 narrow topics (one per feature family); DE lane has 4 broad topics (each grouping multiple comparable concepts).
- **Article length:** 1200–3000 words baseline, up to ~4000 for deep topics. Depth over brevity.
- **Article ↔ problem linkage:** SQL-lane articles MUST link ≥3 `tagSlugs` and ≥3 `relatedProblemSlugs`. DE-lane optional.
- **No new TagKind.** Concept tags reuse `TagKind.TOPIC`. Company tags stay `TagKind.COMPANY`.
- **Tracks unchanged.** No `TrackItem.type` discriminator; Tracks stay problem-only.
- **MCP author tool primary, not the admin UI.** v0.5.1 reality: articles authored via MCP `create_article` / `update_article`; humans review and publish.
- **No prerequisite gating.** Lane order is a recommendation, not enforced.
- **No AI image generation pipeline.** `:::mermaid` for diagrams the LLM can express; `[FIGURE-TODO]` placeholder for anything that needs a human-uploaded raster/SVG.

## Footguns discovered this session

| Footgun | What happened | How to avoid |
|---|---|---|
| **Next dynamic routing returns 200 + text/html for any /learn/** URL** | `curl -sI /learn/img/window-vs-groupby.svg` returns `HTTP/2 200 content-type: text/html`. Looks "live" but is actually Next's catch-all rendering a 404 page. Easy to misread as success. | Always check `content-type` for static-asset URLs, not just status code. The publish validator hardening in Plan Task 2 uses `fs.access` on the filesystem, not an HTTP probe. |
| **Mermaid 11 uses Function constructor at init** | The chunk `chunk-3SSMPTDK.mjs` contains `Function("return this")` — common globalThis polyfill. CSP without `'unsafe-eval'` throws silently → mermaid never bootstraps → user sees only the gray loading placeholder forever. The Learn v2 spec assumed mermaid worked under strict CSP based on a local-dev verification, not a true prod-CSP verification. | Verify mermaid renders on a **deployed preview** with the production CSP headers, not just local dev. Long-term: pre-render mermaid → static SVG at publish time (queued for v0.6) so we can drop `'unsafe-eval'`. |
| **Layer 2 publish validator trusts every `/learn/**` path** | Filters them out of the Asset table check on the assumption that they're repo-committed statics. An LLM author can put any string in `:::figure{src=...}`. v0.5.0 ate this. | PR 1 of the curriculum plan (Tasks 1–4) adds an `fs.access` existence check via a new `validateLearnFigurePaths` helper. Plan also rewrites the author prompt to forbid LLM-generated `/learn/img/*` paths entirely. Defense in depth. |
| **MCP article relations were already shipped but invisible** | The user asked for "MCP should be able to link related problems on publish" and "tags" — both already wired through schema, admin API, MCP input, ArticleVersion snapshot, and page rendering as of v0.5.1. The MCP author prompt didn't mention them, so the LLM never used them. | New author prompt (Plan Task 18) mandates `list_tags` + `list_problems` discovery before drafting, and ≥3 entries in `tagSlugs[]` / `relatedProblemSlugs[]` for SQL-lane articles. |
| **Switching branches reset middleware.ts to main's state** | Mid-session I switched off `fix/learn-csp-mermaid-analytics` (PR #124) to commit the spec on a new docs branch off main. System reminded me that middleware.ts had been "modified". Not actually modified — git switched back to main's version. Easy to misread as user editing files behind me. | PR #124's changes only exist on its branch until merge. Don't re-apply or re-verify them on other branches.|

## Open follow-ups

In rough priority order:

1. **Merge PR #124 (CSP hotfix) and cut a v0.5.0.2 release PR.** Mermaid + analytics fix lights up immediately. Browser-smoke `joins/how-a-join-works` and `window-functions/first-look-at-window-functions` on the Vercel preview before merging — both `:::mermaid` blocks should render within 3s.

2. **Stakeholder review of PR #125 (spec + plan).** No code; review the curriculum decisions. Push back on lane structure, topic list, or per-article skeleton before implementation kicks off. Specific things to double-check: do you actually want the existing `data-engineering-101` topic kept as a broad multi-article topic, or split into three (oltp-vs-olap, etl, batch-vs-stream-processing)? Spec chose to keep it broad.

3. **Resume plan execution.** Branch `fix/article-publish-validator-learn-asset-existence` is already cut off main. Plan task 7 (Task 1 in plan numbering) is in_progress in TodoWrite but nothing committed. Next move: spawn an implementer subagent with the Task 1 text (plan §"Task 1 — Add the failing /learn/** existence test"). The plan has the full code block; the subagent's job is mechanical. Use sonnet. Then Task 2 (implementation), Task 3 (regression check), Task 4 (push + open PR 1). After PR 1 lands → Tasks 5–16 (PR 2: topic lanes) → Tasks 17–19 (PR 3: author prompt rewrite) → Task 20 (production seed dry-run).

4. **Carryover from prior handoff (still open):**
   - Stashed `.env*.local` gitignore change.
   - MCP-server typecheck still not in CI (`.github/workflows/test.yml`).
   - MCP e2e smoke for article tools (extend `scripts/mcp-e2e-test.mjs`).
   - PR #117 lucide-react major upgrade.
   - Drop legacy `solutionSql` / `expectedOutput` columns (v0.5.0 cleanup).
   - Admin abuse-delete `hasVisualBlocks` recompute (one-line fix in `app/api/admin/assets/[id]/route.ts`).
   - De-hardcode seed admin email in `prisma/seed-visual-lesson.ts`.
   - `npm run lint` ESLint plugin error.

5. **v0.6 long-term:** pre-render `:::mermaid` blocks to static SVG at publish time (mermaid-cli/headless). Lets us drop `'unsafe-eval'` from `/learn/**` CSP again. Out of scope for v1 curriculum; queued.

## Reference docs

- **The spec:** `docs/superpowers/specs/2026-05-22-learn-curriculum-design.md`
- **The plan:** `docs/superpowers/plans/2026-05-22-learn-curriculum-infrastructure.md`
- **Prior session handoff (Learn v2 launch):** `docs/superpowers/handoff/2026-05-21-learn-v2-launch-handoff.md`
- **Learn v2 visual articles design:** `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`
- **Layer 2 publish validator (target of plan Task 2):** `actions/article-publish-validation.ts`
- **MCP article tools (target of plan Task 10):** `mcp-server/src/tools/topics.ts`
- **MCP article tools (already shipped, reference only):** `mcp-server/src/tools/articles.ts`
- **Author prompt to be rewritten (plan Task 18):** `docs/superpowers/prompts/learn-v2-article-author.md`

## To resume execution (concrete commands)

```bash
# 1. Confirm branch state
git fetch origin
git status   # expect: on fix/article-publish-validator-learn-asset-existence, clean

# 2. Confirm PRs are still open
gh pr view 124 --json state,mergeable
gh pr view 125 --json state,mergeable

# 3. Resume plan via subagent-driven-development
# Read: docs/superpowers/plans/2026-05-22-learn-curriculum-infrastructure.md
# Start at Task 1, dispatch implementer with the FULL text of Task 1 as the prompt.
```

How to ask the user: terse, decisive, "ok" and digit replies common. They redirect if needed.

Session is in a clean stopping state — both PRs open, plan ready to execute, no half-committed work on any branch.
