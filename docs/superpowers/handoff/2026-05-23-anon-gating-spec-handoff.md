# Handoff — v0.5.0.2 shipped to prod, curriculum infra landed on main, anon-gating spec drafted (3 Codex passes)

**Date:** 2026-05-23
**From:** Claude session that closed the v0.5.0.2 release loop, landed Plan PR 2 + PR 3 from the curriculum-infrastructure plan, and drafted the anonymous-access gating spec under three iterative Codex adversarial reviews.
**Continues:** `docs/superpowers/handoff/2026-05-22-curriculum-and-csp-hotfix-handoff.md`.
**For:** the next AI / engineer.

## TL;DR

Two things this session:

1. **Closed out the v0.5.0.2 + curriculum-infra rollout** (PRs from prior handoff). All three open PRs from yesterday merged. CSP hotfix + Learn figure validator + topic-lanes schema + concept tags + author prompt rewrite are now on `main` (and v0.5.0.2 specifically is on `production`). Mermaid and analytics should be working on `/learn/**` in prod. Topic-lanes-and-ordering migration auto-applied; seeds still need to run against production once.

2. **Drafted a comprehensive anonymous-access gating spec** at `docs/superpowers/specs/2026-05-23-anonymous-access-gating-design.md` (320 lines, 4 commits on `docs/anon-access-gating-spec`). LeetCode-style freemium: 3 free problems per browser, then sign-in wall on the workspace, counted on first user-action that calls the engine (Run *or* Submit — fixing a real Submit bypass that Codex caught). Three iterative Codex adversarial reviews resolved 7 distinct findings; spec is now design-tight enough to move to writing-plans. Not yet pushed / PR'd.

**One real functional bypass caught by Codex** worth noting: `SqlPlayground.handleSubmit` runs the in-browser engine query *before* calling `onSubmit`, so the existing `validateSubmission` auth gate (which only blocks the Submission DB row write) wouldn't block an anon past quota from pressing Submit / Ctrl+Shift+Enter on a new problem and seeing the result table render. The spec now gates both Run and Submit via a shared `gateAndExecute(intent)` helper.

## Where things stand

### Production
- **Tag:** `v0.5.0.2` live (merged from PR #127 at 2026-05-22T13:22:16Z).
- **Now working on `/learn/**`:** Mermaid charts render under the relaxed CSP; Google Analytics + Vercel Speed Insights fire. **Verify in prod yourself before assuming fixed.**
- **Publish validator hardened:** any new article with a `/learn/img/...` figure src whose file doesn't exist (or is a directory) is rejected at publish time. Defense in depth against the LLM-author footgun.

### `main`
- **HEAD:** PR #129 merge (author prompt rewrite). Ahead of `production` by the topic-lanes schema + author prompt commits. Migration `add_topic_lane_displayorder` auto-applies on the next production deploy.
- **All three PRs from yesterday merged:** #127, #128, #129. The `feat/topic-lanes-and-ordering` and `docs/learn-author-prompt-rewrite` branches are deleted (auto-delete on merge).

### Open PRs (other than mine)
- **#117** `chore(deps): bump lucide-react 0.562 → 1.16` — dependabot major upgrade, sitting since May 18. Still needs an upgrade-guide pass. Pre-existing carryover.

### Local branch (not pushed)
- **`docs/anon-access-gating-spec`** — 4 commits, all docs-only:
  - `b47a363` — initial spec (228 lines)
  - `aa7aec6` — Codex pass 1 fixes (gate boundary, sign-in reset, advisory framing)
  - `be66da8` — Codex pass 2 fixes (Submit bypass, Navbar boundary)
  - `acda634` — Codex pass 3 fixes (stale non-goal cleanup, OAuth remount bug)
  - Tip: spec is 320 lines. Diff vs main is +320/−0.

### Other untouched local state
- Untracked (carryover): `.claude/scheduled_tasks.lock`, `.codex/`, `AGENTS.md`, the entire `docs/superpowers/handoff/` directory (gitignored), `.codex/agents/code-reviewer.toml`, `.codex/agents/file-explorer.toml`.
- Stashed `.env*.local` gitignore change from a prior session — still in `git stash list`.

### Plan Task 20 still pending
The curriculum-infrastructure plan (`docs/superpowers/plans/2026-05-22-learn-curriculum-infrastructure.md`) has Task 20 — "production seed dry-run" — still unticked. After v0.5.0.2's release, the topic-lanes migration has applied to production via the next deploy, but `npm run seed:curriculum-topics` and `npm run seed:curriculum-tags` haven't run against prod yet. Without that, `/learn` on production still shows topics in the old alphabetical order without lane sections.

**To run:**
```bash
vercel env pull .env.production.local
DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-topics
DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-tags
```

Then browser-smoke `https://www.learndatanow.com/learn` for the two-lane layout.

## What shipped this session

| PR / Artifact | Where | What |
|---|---|---|
| PR #127 (`release: v0.5.0.2`) | merged to production 13:22Z 2026-05-22 | CSP hotfix (Mermaid + analytics) + Learn figure existence validator + curriculum docs. |
| PR #128 (`feat/topic-lanes-and-ordering`) | merged to main 13:23Z | Topic.lane + Topic.displayOrder schema migration, /learn two-lane render, MCP `update_topic` tool, idempotent seed scripts. |
| PR #129 (`docs/learn-author-prompt-rewrite`) | merged to main 13:28Z | Rewrites the article author prompt to forbid LLM `/learn/img/*` paths and mandate `tagSlugs[]` + `relatedProblemSlugs[]`. |
| Validator follow-up commit `bcd3874` | landed in PR #126 (merged earlier in #127) | Code-review follow-ups: `fs.stat` + `isFile()` instead of `fs.access`, drop `hasVisualBlocks: false` from ok-true result type, add path-traversal + directory-rejection tests, drop stray period in error message, move PASS log into async success callback. |
| Anonymous gating spec | `docs/superpowers/specs/2026-05-23-anonymous-access-gating-design.md` (not yet pushed) | 320-line spec for LeetCode-style 3-free-problems gate with full Codex review hardening. |

## Decisions locked this session (don't relitigate)

For the **anonymous access gating spec** (a.k.a. v0.6 conversion funnel):

- **Goal of the gate:** drive sign-ups while preserving SEO discovery. Not a security boundary.
- **Posture:** conversion nudge backed by a soft server check. Not authoritative. Two-tab race, cookie-clear, and incognito are all accepted bypasses for v1.
- **Quota:** 3 free problems. Single constant in `lib/anon-gate.ts`. Tunable.
- **Trigger:** **both Run (Cmd/Ctrl+Enter) AND Submit (Cmd/Ctrl+Shift+Enter)** via a shared `gateAndExecute(intent)` helper in `SqlPlayground.tsx`. The shared `runQuery` in `useProblemDB` is *not* gated (so background schema/sample loading still works).
- **Storage:** `localStorage["dl:anon:startedSlugs"]` mirrored to an HMAC-signed `dl_anon_started` cookie. New env var `ANON_GATE_SECRET`.
- **Sign-in reset:** two independent triggers. Cookie cleared server-side in a new NextAuth `events.signIn` handler. localStorage cleared by a new client component `components/auth/AnonStorageReset.tsx` (mounts in `app/layout.tsx`, receives `isSignedIn` as a prop derived from the layout's existing `auth()` call). **Clears on every mount while `isSignedIn === true`**, not on a `false → true` transition — because OAuth callbacks fully remount the layout.
- **Navbar stays a server component.** No `useSession()` added to it (would force converting it to a client component or adding a SessionProvider). The reset uses its own dedicated client component instead.
- **UI:** subtle chip next to Run shows `"3 free runs"` / `"2 free runs left"` / `"1 free run left"` (amber). Hidden on already-started slugs. Sign-in modal triggered by `onTrialExhausted` callback for both Run and Submit intents.
- **What stays public, unchanged:** `/learn/**`, discussion reads, the `/practice` catalog list, `/api/health`. Sign-in walls only fire inside the workspace on a new (4th+) problem.
- **What's deferred to v1.1:** server-side `AnonSession` table with atomic append/check. Triggered by telemetry: if conversion < 15% or wall-shown counts are implausibly low in week 2.

For the **curriculum + infrastructure** (carried from yesterday):

- All `D` (mixed audience), `B` (SQL + DE concepts, tool-agnostic), `C` (two lanes), `A` (~10 topics × 1 pillar article) decisions from yesterday remain in force. Schema is live. Author prompt is live.

## What Codex caught (cumulative across 3 review passes)

For posterity — these are the failure modes the spec now mitigates. Don't relax these without re-reading why.

1. **[pass 1, high] Gate boundary could count non-Run engine calls.** Original spec hooked the gate into `ProblemClient`'s `runQuery` flow; that's shared with background schema introspection. Fixed by hooking only into `SqlPlayground.handleRun`/`handleSubmit` user-action handlers immediately before the engine call. Added a regression e2e: open 4 problems without clicking Run/Submit → counter stays 0.

2. **[pass 1, high] Sign-in reset path was unreliable.** Original spec relied on "the `/auth/signin` page clears localStorage on mount" — but OAuth callbacks bypass that page entirely. Fixed by splitting into two independent triggers (server cookie via NextAuth event + client localStorage via dedicated mount-effect component).

3. **[pass 1, medium] Cookie-only enforcement was not authoritative.** Two-tab race, incognito bypass, cookie clear all defeat it. Originally framed as "server is authoritative" — false. Reframed honestly as "conversion nudge backed by a soft server check" with explicit acceptance of bypass paths. Server-side `AnonSession` table moved to v1.1 with explicit telemetry trigger.

4. **[pass 2, high] Submit-shortcut bypass.** The most important catch. `SqlPlayground.handleSubmit` runs the engine query *before* calling `onSubmit`. The existing server `validateSubmission` gate only blocks the Submission DB row write — not the in-browser engine call. So an anon past quota could press Submit / Ctrl+Shift+Enter on a 4th problem and see the engine result render. **Closed:** gate now wraps both `handleRun` and `handleSubmit` via shared `gateAndExecute(intent)`. Added a dedicated e2e (Submit bypass test).

5. **[pass 2, medium] Navbar boundary conflict.** Spec said "watch `useSession()` in Navbar to reset localStorage" — but `components/layout/Navbar.tsx` is an async server component that imports `auth()` and `prisma`. Adding `useSession` would force converting it to a client component or adding a `SessionProvider` boundary. **Closed:** new dedicated client component `AnonStorageReset` fed by a server-derived `isSignedIn` prop. Done criteria includes an explicit "Navbar still a server component" check.

6. **[pass 3, high] Stale non-goal still excluded Check Answer.** The Non-goals section's "Don't gate Check Answer" line was leftover from before pass 2; implementer following it would skip Submit gating. **Closed:** deleted the non-goal; replaced the post-matrix line with an explicit "every user-action path that calls runQuery passes through gateAndExecute" invariant.

7. **[pass 3, medium] OAuth callback remount defeats `prevRef === false → true` transition.** Pass-2 `AnonStorageReset` used a `useRef`-based prev-state tracker. But OAuth flows navigate away, return through `/api/auth/callback/<provider>`, and remount the root layout fresh. The transition condition never fires because `prevRef.current = null` on first mount. **Closed:** drop the prevRef logic. Clear localStorage on every mount while `isSignedIn === true` (removeItem is a no-op when absent). E2e test updated to use a real OAuth round-trip via Playwright mock route, not an in-place prop flip.

## Open follow-ups (priority order)

1. **Decide pass-4 Codex review or move forward.** The user typed "ok" agreeing to "pass 3" — pass 3 found 2 more real things — and then immediately typed "handoff". Read: they want a break. When work resumes, the open question is whether to (a) run a 4th Codex pass (cheap, may find another subtle thing), (b) push + open PR for human review, or (c) skip ahead to writing-plans. **My recommendation:** one more pass. Each pass has paid off so far, and the spec hits implementation code touching auth + workspace + cookies — get it right on paper.

2. **Run Task 20 production seed.** Curriculum-infrastructure plan still has this unticked. Without it, `/learn` on production still has the old alphabetical ordering. Commands above in the "Plan Task 20" subsection.

3. **Push branch `docs/anon-access-gating-spec` and open a docs PR**, similar to PR #125 pattern. Doc-only, low risk, gives team a chance to review the spec before plan-writing. Could be combined with pass-4 — either approve PR first then implement, or implement off the unmerged branch.

4. **Article authoring cycle.** The curriculum spec's 12 articles (7 new + 5 refreshed) is the natural follow-up to the curriculum-infra merge. New author prompt is live; MCP `update_topic` tool is live; concept tags are seeded (locally — production still pending Task 20). Once Task 20 runs, an author can start drafting.

5. **Carryover from prior handoffs (all still open):**
   - PR #117 lucide-react major upgrade.
   - MCP-server typecheck still not in CI.
   - MCP e2e smoke for article tools (extend `scripts/mcp-e2e-test.mjs`).
   - Drop legacy `solutionSql` / `expectedOutput` columns (v0.5.0 cleanup).
   - Admin abuse-delete `hasVisualBlocks` recompute one-line fix.
   - De-hardcode seed admin email in `prisma/seed-visual-lesson.ts`.
   - `npm run lint` ESLint plugin error.
   - Stashed `.env*.local` gitignore change.
   - v0.6 mermaid → static SVG pre-rendering project (so we can drop `'unsafe-eval'` from CSP).

## To resume execution (concrete commands)

```bash
# 1. Where am I?
git status
git branch --show-current   # expect: docs/anon-access-gating-spec
git log --oneline -5        # expect: acda634 ... be66da8 ... aa7aec6 ... b47a363

# 2. What does prod look like? Confirm v0.5.0.2 actually shipped Mermaid.
curl -sI https://www.learndatanow.com/learn/joins/how-a-join-works \
  | grep content-security-policy   # expect 'unsafe-eval' in script-src

# 3. Three options for the gating work:
# (a) Pass 4 Codex:
node "/Users/anchitgupta/.claude/plugins/cache/openai-codex/codex/1.0.4/scripts/codex-companion.mjs" \
  adversarial-review "docs/superpowers/specs/2026-05-23-anonymous-access-gating-design.md" --wait

# (b) Push spec + open docs PR for human review:
git push -u origin docs/anon-access-gating-spec
gh pr create --base main --title "docs(specs): anonymous access gating — free-trial workspace wall" \
  --body "..."  # see spec for content

# (c) Skip to plan-writing:
#     Use the superpowers:writing-plans skill on the spec.

# 4. Run Task 20 production seeds (independent; should happen anyway):
vercel env pull .env.production.local
DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-topics
DOTENV_CONFIG_PATH=.env.production.local npm run seed:curriculum-tags
# Then visit https://www.learndatanow.com/learn — should show two lane columns.
```

## How to ask the user

Same as prior handoffs. Terse, decisive. "ok" and digit replies common. They will redirect if a call is wrong.

This session: ~8 hours of work continuous from the prior handoff. Each Codex pass adds another ~5 min. The user shows comfort with the iterative spec-hardening flow but typed `handoff` after pass 3 instead of accepting pass 4, suggesting they want a break.

## Reference docs

- **The new gating spec:** `docs/superpowers/specs/2026-05-23-anonymous-access-gating-design.md` (not yet pushed)
- **The curriculum spec:** `docs/superpowers/specs/2026-05-22-learn-curriculum-design.md`
- **The curriculum infra plan:** `docs/superpowers/plans/2026-05-22-learn-curriculum-infrastructure.md` (Task 20 still pending)
- **Prior session handoff:** `docs/superpowers/handoff/2026-05-22-curriculum-and-csp-hotfix-handoff.md`
- **Learn v2 visual articles design:** `docs/superpowers/specs/2026-05-20-learn-v2-visual-articles-design.md`
- **Existing `validateSubmission` auth gate (the pattern the new gate mirrors):** `actions/submissions.ts:36-42`
- **The Submit bypass landmark:** `components/sql/SqlPlayground.tsx` — `handleSubmit` runs `runQuery` *before* `onSubmit`. Read this file before implementing the gate or the bypass test.
- **The Navbar boundary landmark:** `components/layout/Navbar.tsx` — async server component importing `auth()`, `prisma`, `getNavLinks`. Do NOT convert to client component for any gating implementation.
- **NextAuth events typing:** `node_modules/@auth/core/index.d.ts` — confirmed `events.signIn` is a real callback the spec can hook into.

Session in clean stopping state — all yesterday's PRs merged, gating spec at a coherent v3 with 3 Codex passes resolved, no half-committed work, branch ready to push or iterate.
