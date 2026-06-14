# Handoff — Learn v2 shipped (v0.5.0 live, v0.5.1 release PR open)

**Date:** 2026-05-21
**From:** Claude session that spec'd, planned, built, reviewed, shipped, and seeded Learn v2 visual articles end-to-end in one continuous session.
**Continues:** `docs/superpowers/handoff/2026-05-21-learn-v2-spec-and-plans-handoff.md` (the early-session handoff before implementation).
**For:** the next AI / engineer.

## TL;DR

Long-deferred task #59 (Learn v2 ByteByteGo-format visual articles) **shipped end-to-end in one day**. Three sequential feature PRs (A/B/C) landed on main, release PR #121 merged main → production tagged `v0.5.0`, backfill + seed ran on prod, "How a JOIN works" reference lesson live at <https://www.learndatanow.com/learn/joins/how-a-join-works>. Follow-on PR #122 (docs + MCP article authoring tools) merged; release PR #123 for v0.5.1 open and awaiting CI / merge.

**One known production issue** — CSP on `/learn/**` blocks Google Analytics and Vercel Analytics scripts. Lesson content renders fine for learners; analytics ingestion is dark on Learn pages. Hotfix path documented below.

## Where things stand

### Production
- **Tag:** `v0.5.0` (commit `c1df4ae`), deployed 2026-05-21 08:39 UTC.
- **Live:** Learn v2 directive renderer, asset upload infrastructure, CSP on `/learn/**`, three published articles plus the new seeded "How a JOIN works" lesson.
- **Health:** `curl https://www.learndatanow.com/api/health` → 200, DB latency ~65ms.

### `main`
- **HEAD:** the merge of PR #122 (`7c083f9`). Six commits ahead of `production`.
- **Open release PR:** **#123** `release: v0.5.1` — main → production. UNSTABLE at last check (waiting on e2e + Analyze jobs). **No deploy impact** when merged — the 6 commits are all `docs/**` + `mcp-server/**`, neither of which Vercel ships. Tagging it keeps the changelog tidy.
- **PR #122 lives here** — docs (spec + plans + prompts) + MCP article tools (`list_articles`, `get_article`, `create_article`, `update_article`).

### Local state to clean up
- **Stashed gitignore change:** `git stash list` will show `wip: .env*.local gitignore add (from prod env-pull workflow)`. Restore with `git stash pop` on `main`. Decide whether to commit as a separate chore or fold into the next PR.
- **Pre-existing untracked files** (untouched, leave alone): `.claude/scheduled_tasks.lock`, `.codex/`, `AGENTS.md`, `docs/superpowers/handoff/` (the handoff directory itself is untracked per repo convention).

## What shipped this session

| PR | Release | What |
|---|---|---|
| **#118** | v0.4.13 (ships dark) | Asset infrastructure. `Asset` + `UserAssetQuota` + `quotaReleasedAt` marker. Two-phase upload at `/api/me/uploads` (atomic quota UPDATE + PENDING Asset insert in one transaction). `DELETE /api/admin/assets/[id]` two-stage abuse-delete with `DELETING` intermediate state + durable retry. Daily `/api/cron/asset-gc` with three reconciliation sweeps. |
| **#119** | v0.4.14 (ships dark) | Directive renderer + CSP. Five `remark-directive` blocks (`:::figure`, `:::mermaid`, `:::steps`, `:::side-by-side`, `:::callout`). Mermaid lazy-loaded with `securityLevel: 'strict'` + DOMPurify SVG sanitization. CSP nonce + directive set on `/learn/**` only. Layer 1 validator (Prisma-free) in `lib/admin-validation.ts`. `check:mcp-bundle-isolation` CI gate. |
| **#120** | v0.5.0 (the reveal) | Publish wiring. `Article.hasVisualBlocks` + backfill. Layer 2 validator (`actions/article-publish-validation.ts`, server-only, Prisma-aware) wired into all four PUBLISHED transition paths. `ArticleEditor` Insert menu + "My uploads" panel. "Visual" pill on `/learn`. Seed lesson "How a JOIN works". **Critical fix that wasn't in the plan:** CSP nonce propagation from middleware → request headers → `app/layout.tsx` → `ThemeProvider` → next-themes inline script. Without this, Next bootstrap scripts would have been blocked on every Learn page. |
| **#121** | v0.5.0 release | `main → production` release PR. Six bot-comment conversation resolved as false positive (off-by-one comparison Codex pattern check; `JS array out-of-range returns undefined, the guard handles it`). |
| **#122** | v0.5.1 (MCP only) | Reference docs (spec, three plans, author prompts) + MCP article tools. Codex adversarial review surfaced two findings; both fixed before merge (typecheck via `ApiError` constructor misuse; nested `topic.slug` shape in `list_articles`). |
| **#123** | v0.5.1 release | Open. Awaiting CI + merge. |

## What the four Codex rounds caught in v0.5.0

For posterity — these shaped the v0.5.0 spec. The implementations preserve every one of these invariants. Don't relax them.

1. **Publish validation triggers on resulting PUBLISHED state, not transitions.** PATCH editing `content` while `status` stays PUBLISHED must validate.
2. **Quota UPDATE + PENDING Asset INSERT happen in one transaction.** No partial-commit leak window.
3. **Strict figure-asset ownership.** `Asset.ownerId === article.authorId`, no admin override. Closes cross-user content-piggyback.
4. **Mermaid output DOMPurified.** Triple defense (strict mode + htmlLabels:false + post-render sanitize sweep).
5. **Reference-aware owner soft-delete.** HTTP 409 with list of referencing articles.
6. **Admin abuse-delete uses `DELETING` intermediate state.** Quota stays reserved until blob `del()` confirms.
7. **MCP bundle isolation.** Layer 1 in `lib/admin-validation.ts` stays Prisma-free; Layer 2 in `actions/article-publish-validation.ts` is server-only. `check:mcp-bundle-isolation` esbuild scan in CI.
8. **CSP scoped to `/learn/**` only in v1.** Site-wide rollout deferred.

## Footguns learned this session (add to your list)

| Footgun | What happened | How to avoid next time |
|---|---|---|
| **CSP nonce didn't propagate to inline scripts** | First v0.5.0 attempt set the nonce on response headers only. Next.js layouts read nonces via `headers()` which reads **request** headers. ThemeProvider couldn't see the nonce so next-themes inline script lacked it. | Middleware now writes the nonce to **both** request and response headers via `NextResponse.next({ request: { headers } })`. Verified by `learn-csp.spec.ts` regression test. |
| **CSP broke Google Analytics + Vercel Analytics on /learn/****| Live discovery during browser smoke after v0.5.0 deploy. `script-src 'self' 'nonce-...'` doesn't allow external GTM script, and the GA inline init snippet doesn't carry the page nonce. | Hotfix path: expand `script-src` allowlist to include analytics CDNs + pass nonce to `<GoogleAnalytics>` if `@next/third-parties` supports it. v0.5.0.1 hotfix not yet shipped. |
| **PR #122 typecheck failed on MCP-server even though parent CI passed** | Used `new ApiError(400, { ... })` — but `ApiError(status, message: string, details?)` requires a string. Parent `tsc` didn't catch it because `mcp-server/` has its own tsconfig. CI doesn't run `npm --prefix mcp-server run typecheck` yet. | **TODO:** add MCP-server typecheck to `.github/workflows/test.yml`. Codex flagged this as a follow-up. |
| **MCP `list_articles` returned empty when filtering by topic** | API includes `topic: { slug, name }` (nested), but the tool was checking `a.topicSlug` (top-level). Always missed. | Match the API include shape. Now uses `a.topic?.slug`. Worth adding `scripts/mcp-e2e-test.mjs` coverage. |
| **`prisma format` rewrites schema whitespace across every model** | PR #118 had ~50 whitespace-only lines in `prisma/schema.prisma` from re-alignment. Noisy diff. Reviewable but adds time. | Either run `prisma format` once + commit separately before feature work, or accept the noise. |
| **CSP middleware initially also returned via the `auth()` wrapper** | First v0.5.0 CSP attempt called CSP inside the `auth()` wrapper, which made it accidentally subject to authentication redirects on `/learn/**` (which is public). Hotfix in PR #119 commit `8224fbd` split the middleware so `/learn/**` returns early with just CSP, never touching auth. | Always think about which paths the middleware matcher covers AND whether they need auth. CSP-only paths should not pass through `auth()`. |

## Open follow-ups (no urgency unless noted)

1. **v0.5.0.1 CSP hotfix.** Production data quality issue — GA pageviews + Vercel Speed Insights are zero on `/learn/**` pages. Three options ranked in the session:
   - **A (recommended):** add `https://www.googletagmanager.com`, `https://*.google-analytics.com`, `https://*.vercel-scripts.com`, `https://*.vercel-insights.com` to `script-src` + `connect-src`. Pass `nonce` to `<GoogleAnalytics>` / `<Analytics>` if Next supports it.
   - **B:** add `'unsafe-inline'` to `script-src`. Defeats most of the CSP value.
   - **C:** revert the CSP middleware entirely. Loses the v0.5.0 security win.
2. **Merge release PR #123 for v0.5.1.** No deploy impact. Optional but tidy.
3. **MCP-server typecheck in CI.** Add `npm --prefix mcp-server run typecheck` to `.github/workflows/test.yml`. Codex follow-up.
4. **MCP e2e smoke for article tools.** Extend `scripts/mcp-e2e-test.mjs` to exercise `create_article` / `update_article` / `get_article` / `list_articles`. Codex follow-up.
5. **PR #117 lucide-react 0.562 → 1.16 (major) dependabot.** Sitting since May 18. Needs upgrade-guide pass.
6. **v0.5.0 cleanup items** (still from prior handoffs): drop legacy `solutionSql` / `expectedOutput` columns via PR-A + PR-B sequence.
7. **Admin abuse-delete hasVisualBlocks recompute** — minor data-staleness from PR A. After abuse-delete strips the only `:::figure` from an article, `hasVisualBlocks` doesn't get recomputed until the next PATCH/approve. Fix is one line in `app/api/admin/assets/[id]/route.ts`.
8. **De-hardcode seed admin email** in `prisma/seed-visual-lesson.ts`. Currently looks up `anchitgupt2012@gmail.com`. Fallback to "first ADMIN by createdAt" is a low-cost change.
9. **`npm run lint` ESLint plugin error** — pre-existing, blocks lint runs. Not introduced by Learn v2. Worth investigating.

## To activate the new MCP article tools locally

```bash
git checkout main
git pull origin main
cd mcp-server && npm run build && cd ..

# Confirm the bundle SHA:
DATALEARN_API_KEY=x DATALEARN_BASE_URL=http://localhost:9999 \
  node mcp-server/dist/index.js < /dev/null 2>&1 | head -2
```

Then **fully quit Claude Desktop (`⌘Q`) and reopen.** The startup line in the MCP server logs panel should show a SHA matching the latest commit on `main` (currently `7c083f9` or later). The four new tools (`list_articles`, `get_article`, `create_article`, `update_article`) appear in the `datalearn` namespace.

## Decisions the user has made this session (don't relitigate)

- Approach A (markdown directives) over MDX or block-JSON.
- Five directives in v1; `:::svg` deferred to v1.5.
- Three sequential PRs instead of one mega-PR for v0.5.0.
- Strict figure-asset ownership in Layer 2; no admin override in v1.
- CSP scoped to `/learn/**` in v1, not site-wide.
- MCP article tools shipped in v0.5.1 (this session changed the spec from "deferred to MCP v2" to "shipped now").
- v0.5.1 release tag against `production` even though no user-visible deploy (changelog hygiene).

## How to ask the user

Same as prior handoff. Terse, decisive. "ok" and digit replies are common. They'll redirect if a call is wrong.

The session ran ~12 continuous hours of brainstorming → spec hardening → three sequential implementation PRs → release → live seed lesson → second feature PR → another release PR. They're done for the night. Pick up tomorrow.

## Reference docs

- **The spec:** `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md` (789 lines, 13 Codex findings + fixes documented).
- **The three plans:** `docs/superpowers/plans/2026-05-21-learn-v2-pr-{a,b,c}-*.md`.
- **Author prompts:** `docs/superpowers/prompts/learn-v2-article-author.md`.
- **MCP article tools:** `mcp-server/src/tools/articles.ts`, docs in `mcp-server/README.md` "Articles (v0.5.0+)" section.
- **Prior handoff (pre-implementation, same day):** `docs/superpowers/handoff/2026-05-21-learn-v2-spec-and-plans-handoff.md`.
- **Prior handoff (pre-Learn-v2):** `docs/superpowers/handoff/2026-05-19-end-of-day-handoff.md`.
