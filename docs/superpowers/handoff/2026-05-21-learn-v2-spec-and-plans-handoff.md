# Handoff — Learn v2 spec + plans complete (no code yet)

**Date:** 2026-05-21
**From:** Claude session that brainstormed task #59, hardened the spec through four Codex adversarial-review rounds, and decomposed implementation into three sequential PR plans.
**For:** the next AI / engineer picking this up.

## TL;DR

Started item 5 from the 2026-05-19 punch list — Learn v2 ByteByteGo-format support. **Spec is done and committed on `feat/learn-v2-visual-articles` (789 lines, survived 4 Codex passes). Three implementation plan documents are committed on the same branch (~4,700 lines total). Zero code shipped.** Next session picks up at the execution decision below.

The brainstorm produced one major scope reduction (`:::svg` deferred to v1.5, MCP tools deferred to MCP v2), one architectural split (Prisma-free Layer 1 validator stays in `lib/admin-validation.ts`; Prisma-aware Layer 2 lives in a new `actions/article-publish-validation.ts`), and one release-strategy change (single PR → three sequential PRs, each shippable dark until the final reveal).

## Where things stand

- **Local branch:** `feat/learn-v2-visual-articles`, two commits ahead of `main`:
  - `afeac11` — three plan documents
  - `ba8e2a6` — the spec
- **`main` HEAD:** unchanged from previous session (`1fb9551`).
- **Production:** `v0.4.12` (unchanged).
- **Open PRs on GitHub:** still just #117 (lucide-react major bump, untouched).

## Artifacts produced this session

| Path | Lines | What it is |
|---|---|---|
| `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md` | 789 | Final design. Locked-in: approach A (markdown + `remark-directive`), five directives (`:::figure`, `:::mermaid`, `:::steps`, `:::side-by-side`, `:::callout`), two illustration sources (mermaid + uploaded asset). |
| `docs/superpowers/plans/2026-05-21-learn-v2-pr-a-asset-infra.md` | ~1500 | PR A. `Asset` + `UserAssetQuota` tables, two-phase upload, admin abuse-delete with durable retry, GC cron with 3 sweeps. Ships dark. Target release: v0.4.13. 23 tasks. |
| `docs/superpowers/plans/2026-05-21-learn-v2-pr-b-directive-renderer.md` | ~1300 | PR B. 5 directive components, Mermaid sanitization (DOMPurify + `securityLevel: 'strict'`), CSP middleware on `/learn/**`, Layer 1 validator. Ships dark. Target release: v0.4.14. 19 tasks. |
| `docs/superpowers/plans/2026-05-21-learn-v2-pr-c-publish-wiring-and-reveal.md` | ~1900 | PR C. `Article.hasVisualBlocks` + Layer 2 validator wired into 4 publish paths + editor changes + Visual pill + "How a JOIN works" seed lesson. The reveal. Target release: v0.5.0. 19 tasks. |
| `/tmp/datalearn-learn-v2-preview/index.html` | ~700 | Brainstorm preview. Three approaches (A/B/C) compared visually with a rendered seed article + authoring panes. Not committed to repo. Reproducible — code is in this conversation. |

## What the spec settled (don't relitigate)

These are the load-bearing decisions extracted from the brainstorm + 4 Codex rounds. Anyone touching this work should accept these or escalate explicitly.

### Approach
- **Approach A (markdown + `remark-directive`)** beat MDX and block-JSON. Existing `react-markdown` pipeline preserved. `Article.content` stays a markdown string.
- **`:::svg` inline raw SVG is deferred to v1.5.** Reason: sanitizer needs an AST-based allowlist + CSP defense-in-depth that wasn't worth the v1 scope. Two illustration sources in v1: `:::mermaid` (text-rendered) and `:::figure` (uploaded asset). v1.5 prerequisites are documented in the spec's "Deferred for v1.5" section.
- **MCP article authoring tools (`create_article`, `update_article`) are deferred to MCP v2.** Reason: they don't exist today, the spec previously claimed they did (Codex caught), and they deserve their own design pass. Visual articles in v1 are admin-UI-authored.

### Architecture
- **Validation has two layers, split by import boundary:**
  - Layer 1 `validateArticleDirectivesSyntactic` — `lib/admin-validation.ts`, Prisma-free, MCP-importable. Walks the AST, checks structural rules (allowlist, alt, kind, side-by-side break count).
  - Layer 2 `validateArticleDirectivesForPublish` — `actions/article-publish-validation.ts`, server-only (`"server-only"` import), Prisma-aware. Resolves figure URLs to `ACTIVE` `Asset` rows **owned by the article author** (no admin override in v1).
  - CI gate: `check:mcp-bundle-isolation` builds the MCP bundle via esbuild and asserts no `@prisma/client`, `next/server`, or Layer 2 module reachable.
- **Validation triggers on resulting PUBLISHED state, not transitions.** Codex caught this — a PATCH that edits `content` while leaving `status='PUBLISHED'` must validate. All four entry points wire the helper: admin create, admin PATCH, approve, contributor submit (advisory).
- **Two-phase upload, single-transaction quota reservation.** Codex caught the race window. Quota UPDATE + PENDING Asset insert happen in **one transaction** so they cannot partially commit. Blob write is Phase 2, outside the transaction. Promote PENDING→ACTIVE is Phase 3.
- **`UserAssetQuota.reservedBytes BigInt` with atomic conditional UPDATE.** The race-safe primitive is the SQL `UPDATE ... WHERE reservedBytes + ? <= 100MB`. Postgres row-locks serialize concurrent UPDATEs. Concurrent-upload test asserts the cap holds.
- **`Asset` state machine: `PENDING → ACTIVE → DELETING → DELETED`.** `DELETING` is the new state Codex demanded — it represents the window where references are stripped from articles but the public blob is still live. Quota stays reserved during `DELETING`. Admin abuse-delete only resolves to `DELETED` after blob `del()` confirms (inline 3 retries + GC backstop sweep 1b).
- **Reference-aware owner soft-delete.** `DELETE /api/me/uploads/[id]` returns HTTP 409 with the list of referencing articles if any. Author must remove the figure first. Prevents silent content breakage 7 days later.
- **Admin abuse-delete strips `:::figure` blocks from referencing articles + snapshots `ArticleVersion`.** Uses `unified` + `remark-directive` + `unist-util-visit` to parse and re-serialize. Updates `hasVisualBlocks` afterward.
- **CSP middleware on `/learn/**` only.** Adds `default-src 'self'; script-src 'self' 'nonce-…'; img-src 'self' data: https://*.vercel-storage.com; ...`. Other routes unperturbed in v1.
- **Mermaid: lazy-loaded, `securityLevel: 'strict'`, `htmlLabels: false`, output DOMPurified.** Forbidden tags: `script`, `foreignObject`. Forbidden attrs: `href`, `xlink:href`, `style`, `on*`. CSP is defense-in-depth on top.
- **Single transaction for quota + PENDING insert.** This is the fix for the "quota leak before Asset row exists" finding. Regression-tested in `test-upload-phase1-atomicity`.

### Release strategy
- **Three sequential PRs, not one mega-PR** (user's call after seeing the size). Each shippable independently, dark until the reveal. Easier review, safer revert.
- PR A → v0.4.13, PR B → v0.4.14, PR C → **v0.5.0** (the reveal).
- All three PRs target `--base main`. **CLAUDE.md hard rule: always pass `--base main` to `gh pr create`.**

## What the four Codex rounds caught (don't reintroduce)

Each finding has a fix that's now in the spec. Recording them so the next AI doesn't quietly revert one while editing nearby code.

| # | Round | Severity | Finding | Fix location in spec |
|---|---|---|---|---|
| 1 | 1 | high | Publish validation in `publishArticle()` server action — but repo publishes via REST routes | Single helper invoked from 4 REST entry points. "Publish-time validation" section. |
| 2 | 1 | high | `/api/admin/uploads` collides with admin-only middleware; no rate limit / quota / GC | Moved to `/api/me/uploads`, new `Asset` + `UserAssetQuota` + cron. "Asset upload + management" section. |
| 3 | 1 | high | `:::svg` sanitizer under-specified | `:::svg` deferred to v1.5 with documented prerequisites. "Deferred for v1.5" section. |
| 4 | 1 | medium | MCP `create_article`/`update_article` claimed but don't exist | Removed all MCP claims. "MCP impact" section says "None in v1". |
| 5 | 2 | high | PATCH editing `content` on already-PUBLISHED skips validation | Validation triggers on **resulting** PUBLISHED state. "Wiring — validate the resulting state" subsection. |
| 6 | 2 | high | Mermaid SVG insertion trusts contributor source | `securityLevel: 'strict'` + `htmlLabels: false` + DOMPurify + CSP. "Renderer architecture" + "Content-Security-Policy (new in v1)" sections. |
| 7 | 2 | high | Blob put + DB write not atomic — orphan storage | Two-phase PENDING→ACTIVE + GC sweep 2 reconciliation. "Upload lifecycle (two-phase, durable)" section. |
| 8 | 2 | medium | Soft-deleted assets still embedded after 7 days break articles | Reference-aware owner soft-delete (HTTP 409 if referenced). Admin abuse-delete strips references in transaction. "Admin abuse-delete (hard, durable, unlinking)" section. |
| 9 | 3 | high | Admin approval bypassed contributor asset ownership | Strict `Asset.ownerId === article.authorId` rule, no admin override in v1. Layer 2 description. |
| 10 | 3 | high | Layer 2 in `lib/admin-validation.ts` would break MCP bundle | Layer 2 moved to `actions/article-publish-validation.ts` (server-only). `check:mcp-bundle-isolation` CI gate added. |
| 11 | 3 | high | Quota race window between reservation and Asset insert | Single transaction for quota UPDATE + Asset INSERT. Test: `test-upload-phase1-atomicity`. |
| 12 | 4 | high | Owner soft-delete breaks PUBLISHED articles after GC | Reference-aware check on owner DELETE returning HTTP 409. |
| 13 | 4 | high | Admin abuse-delete reports success while blob still public | `DELETING` intermediate state + inline retries + GC sweep 1b. Quota stays reserved during `DELETING`. |

## Critical things the next AI must NOT change without re-validating

These are the constraints the four Codex passes installed. If you find yourself "simplifying" any of these, stop and read the corresponding finding above.

1. **`lib/admin-validation.ts` must stay Prisma-free.** CLAUDE.md says so. The MCP bundle imports it. PR B adds Layer 1 there; PR C does NOT put Layer 2 there.
2. **Phase 1 (quota reserve + PENDING insert) must be one transaction.** Both-or-neither. The regression test mocks Asset insert to fail and asserts the quota is restored.
3. **Layer 2 figure check is strict ownership** — no admin override. If you find yourself thinking "but admins should be able to publish using anyone's asset"... no. Codex round 3 caught exactly this. Future fix is an explicit "duplicate to current user" admin tool, not a relaxed check.
4. **Mermaid output passes through DOMPurify** even though Mermaid generates its own SVG. The contributor controls the source; defense-in-depth matters; Mermaid has had CVEs.
5. **Owner soft-delete is reference-aware** (HTTP 409 with article list). Do not "simplify" this back to a status-only flip.
6. **Admin abuse-delete uses `DELETING` intermediate state.** Quota stays reserved during `DELETING`. This is on purpose — prevents abuse-delete from being used as a quota reset.
7. **CSP is scoped to `/learn/**` only in v1.** Don't roll it out site-wide in this PR.

## Open questions for the next session

These were surfaced at the end of the session and not yet decided:

1. **How to land the docs commits (spec + 3 plans)?**
   - (a) Open a docs-only PR `main ← feat/learn-v2-visual-articles` first, merge, then PR A/B/C branch off main with clean diffs. **Recommendation.**
   - (b) Include the doc commits in PR A; PR B and PR C reference them via path.
   - (c) Leave the docs on the spec branch and reference locally during execution.
2. **Execution mode for PR A?**
   - (a) **Subagent-driven** (recommended). Fresh subagent per task + two-stage review. Tight feedback loop on a 23-task plan.
   - (b) **Inline** via `executing-plans`. Less context-switching but main session absorbs everything.
3. **Where to host Vercel Blob.** PR A assumes the Vercel Blob integration is already installed and `BLOB_READ_WRITE_TOKEN` is provisioned. If not, the user needs to install it via the Vercel dashboard before PR A can be tested in Preview.
4. **`scripts/test-uploads.ts` requires a test-user header bypass** in `lib/auth.ts` (Task 8). This is a small dev-only carve-out. Worth doing or use a different test strategy (e.g. create real NextAuth sessions)? Spec assumes the header bypass; the next AI should confirm with the user before adding that code.

## Decisions the user has made this session (don't relitigate)

- Approach A over B (MDX) and C (block JSON).
- All five directives in v1; `:::svg` deferred.
- Three PRs instead of one mega-PR.
- Plan all three PRs upfront (user explicitly chose this over plan-as-needed).
- No admin override for cross-owner assets in v1.

## Useful commands for next session

```bash
# Inspect current branch state
cd /Users/anchitgupta/Documents/Github/datalearn
git checkout feat/learn-v2-visual-articles
git log --oneline -5

# Open the spec + plans for review
$EDITOR docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md
$EDITOR docs/superpowers/plans/2026-05-21-learn-v2-pr-a-asset-infra.md

# When ready to start PR A — Task 1 of the plan creates the worktree:
git worktree add ../datalearn-pr-a -b feat/learn-v2-pr-a-asset-infra origin/main

# If choosing the docs-only-PR path (recommended):
gh pr create --base main \
  --title "docs: Learn v2 design spec + 3 PR plans" \
  --body "Pre-implementation docs only. No code change. Three implementation PRs (A/B/C) will follow."
```

## How to ask the user

Same as 2026-05-19 handoff. Terse, decisive, "no interruptions during build phase." They'll redirect if the call is wrong; don't over-confirm.

The user has been deep in this session for many hours of brainstorm + spec-hardening. They asked for a handoff specifically to break here. **Default to assuming they'll pick up the next session ready to execute PR A** — keep the kickoff lightweight.

## Reference docs

- `CLAUDE.md` — conventions.
- `docs/ROADMAP.md` — through v0.4.12. v0.4.13/v0.4.14/v0.5.0 entries will land with their respective PRs.
- `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md` — **the spec**.
- `docs/superpowers/plans/2026-05-21-learn-v2-pr-a-asset-infra.md` — start here.
- `docs/superpowers/plans/2026-05-21-learn-v2-pr-b-directive-renderer.md`.
- `docs/superpowers/plans/2026-05-21-learn-v2-pr-c-publish-wiring-and-reveal.md`.
- `docs/superpowers/handoff/2026-05-19-end-of-day-handoff.md` — previous session, has the 5 footguns to keep in mind (stale MCP bundle, nested `<a>`, `tagSlugs` REPLACE, `create_tag` upsert, Next 16 streaming-200). All five are referenced where relevant in the PR plans.
