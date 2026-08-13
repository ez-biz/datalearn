# Handoff — blockers cleared, SP5 specced and planned, no code written yet

> **Supersedes [`2026-08-10-sp3-merged-sp4-sp5-sp7-next-handoff.md`](./2026-08-10-sp3-merged-sp4-sp5-sp7-next-handoff.md).** Its top two follow-ups are done and its `node` section is obsolete. Its *Decisions locked*, *Recurring patterns* and the SP2/SP3 environment traps are still accurate and are carried forward below.

## TL;DR

Both blockers are cleared. **`node` is fixed** (`v26.7.0`) and **the 44 orphaned SP3 tests now run in CI** — PR #195, merged as `22c197e`, first green run 6m18s.

**SP5 is specced and planned but not started.** `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md` and `docs/superpowers/plans/2026-08-11-sp5-workspace.md` — 19 tasks across four phases — sit on **`docs/sp5-workspace-spec`, which is unpushed with no PR.** That is the same shape as follow-up 7's stranded `docs/sp2-handoff`. Push it before anything else.

**New finding:** the CI gap was never an SP3 problem. **40 of the 60 `test:`/`check:`/`audit:` scripts are absent from `test.yml`** — the two SP3 suites were just the two anyone had noticed.

**Still true:** production is `6031ac5`, `main` is **133 commits ahead**, and nothing from SP1/SP2/SP3 is live.

---

## Where things stand

### `main` (`22c197e`)

Working tree clean. Contains SP1 + SP2 + SP3, the dependabot merges, and #195.

### Sub-project status

| | Depends on | Status |
|---|---|---|
| SP1 Curriculum spine | — | **merged** (PR #182) |
| SP2 Tokens + shell | — | **merged** (PR #184) |
| SP3 Lesson reader | SP1 + SP2 | **merged** (PR #185) |
| SP4 Index screens | SP1 + SP2 | **ready** |
| **SP5 Workspace** | SP1 + SP2 | **specced + planned, unpushed, no code** |
| SP7 Admin redesign | SP1 + SP2 | **ready** |
| SP6 Home + mobile | SP4 + SP5 | blocked on two |

**Next code work is SP5 phase 1** — `isAppRoute` plus the `ConsoleChrome` branch plus the `@theme inline` guard. It is three tasks, touches almost nothing, and is a clean place to start cold.

---

## Environment

**`node` is fixed.** It had been linked against a simdjson Homebrew moved from `.31` to `.33`; `brew reinstall node` resolved it. Local is now **`v26.7.0` / npm `11.19.0`**. The nvm workaround is no longer needed.

⚠️ **The runtime split outlived the fix, and it is now permanent: local is Node 26, CI pins Node 20** (`node-version: "20"` in `test.yml`). Two consequences, both of which have already cost time:

1. **They disagree on `node --test` output.** Node 20 emits TAP (`# pass 51`), Node 26 emits `ℹ pass 51`. **Judge suites by exit code, never by grepping output** — a grep for `# pass` reports "no results" rather than a failure.
2. **APIs that exist locally may not exist in CI.** `fs.globSync` landed in Node 22; a guard script using it passes locally and fails only in CI. This was caught while writing the SP5 plan, before it shipped.

**New:** `tsconfig.json` includes `**/*.ts` with `strict: true` and excludes only `node_modules` and `mcp-server` — so **`scripts/*.ts` is type-checked by `npx tsc --noEmit`**. Test helpers need real types; a nullable return needs a non-null assertion or `tsc` fails even though `tsx` runs the file happily.

**Resolved:** `.env.production.local` is gone — renamed to `.env.production.local.disabled`. The trap where e2e ran against production with a blank `AUTH_SECRET` is closed.

**Still live:** `npm run dev` binds to `.env.local`, which points at production Neon — prefix `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn'` for local data. `rg` is not on `#!/bin/sh`'s PATH (verify guard scripts under `env -i PATH=/usr/bin:/bin /bin/sh -c '...'`). Never `next build` without `--webpack` — use `npm run build`. `gh` lacks `workflow` scope, so **any PR touching `.github/workflows/` needs a web-UI merge**. PRs must pass `--base main`; the default is `production`.

---

## What this session did

**Cleared both blockers (PR #195, merged).** Fixed `node`; added `test:lesson-nav` and `test:reading-progress` to `test.yml`. Both ran green on CI's Node 20 at `# pass 27` / `# pass 17`, matching local. Also re-verified all five resume checks by exit code: 51 / 27 / 17 / 7 / exit 0.

**Specced and planned SP5.** Design decisions were taken deliberately and are recorded below. The plan is deliberately front-loaded with a **capability inventory** — ten behaviours that exist today, appear in none of the design screenshots, and would vanish silently when `ProblemPanel` (525 lines) and `SqlPlayground` (451 lines) are split.

**One of those ten the spec had missed: the contest lock.** `app/practice/[slug]/page.tsx:195-210` renders a warning banner and passes `submissionDisabledReason`, which disables Submit while a problem is in a contest. No design screen shows it. It is exactly the SP2 "capability lost in a deletion" shape, found only by reading the file rather than the design.

---

## Decisions locked — SP5

From the brainstorm on 2026-08-11. Don't relitigate without new information.

| Decision | Choice |
|---|---|
| Mobile workspace | **Out of scope** — SP6's. SP5 stops at `lg` (1024px) |
| Pass rate | **Build it** — denormalized `attemptCount`/`acceptedCount` on `SQLProblem` |
| Community approaches | **Build them** — on `DiscussionComment` via a `kind` enum |
| Approach posting gate | **Any signed-in user**, mitigated by a computed `verified` mark, not a gate |
| Approach cardinality | One per user per problem, editable — *assumed, not separately confirmed* |
| Problems panel scope | Full published catalog; ungrouped problems in a final "Not in a track" group |
| Shell mode | **New `isAppRoute` predicate** beside `isFocusRoute` — sidebar kept, footer and page scroll dropped |
| Results-pane `History` | Renamed **Runs** — session-local, client-only. Resolves a duplicate tab name in the design |

**Phase 2 ends with a shippable workspace.** Pass rate is phase 3 and approaches are phase 4, so if the user-generated-content surface needs its own thinking, the redesign is already live without it.

### Carried forward from SP2/SP3, still binding

- New curriculum route, shared `LessonBody`; the topic URL is canonical.
- The module is not in the URL; the `04-` prefix derives from `position` at render time.
- DRAFT tracks render for ADMIN/MODERATOR only. **Publishing is still not done** — only admins can see the reader.
- `#app-scroll` is the single scroll container.
- Blocks with no backing data are omitted, not faked.
- Big-bang on `main`, hold production. `--panel-hover` is for `--panel` chrome only.

---

## Recurring patterns worth internalising

Unchanged from the last handoff, and all three recurred this session.

**1. Capability lost in a deletion.** The contest lock (above) is the newest instance. **When deleting or splitting a component, diff what it provided against what replaces it.**

**2. New tests that never run.** Now fixed for SP3's two suites — but see follow-up 1: the gap is twenty times larger than anyone thought. The SP5 plan requires every new suite to get its `test.yml` line **in the PR that adds it**.

**3. Verification aimed slightly off the real question.** The SP5 plan names two places this design invites it: a pass-rate backfill must be checked by **recomputing the aggregate and comparing values**, not by confirming the columns are non-zero; and "no footer" must be asserted by querying for `contentinfo`, not by eyeballing a screenshot where the footer is merely below the fold.

---

## Open follow-ups (priority order)

1. **Push `docs/sp5-workspace-spec`** (2 commits: `e0d018b` spec, `2ccc45d` plan) and open its PR with `--base main`. Unpushed, laptop-only, repeating follow-up 4's failure.
2. **The CI gap is 40 scripts, not 2.** Auditing all 60 `test:`/`check:`/`audit:` scripts against `test.yml` — the only workflow file — shows 40 unreferenced. Largest clusters: **~15 contest suites**, **7 upload/asset suites**, plus `test:directive-renderer`, `test:mermaid-sanitization`, `test:admin-audit-log`, `test:topic-lane`, `test:discussion`, `test:sql-validator-json-time`, `test:sql-engine-result-cap`, `test:sql-engine-runtime-controls`, `test:dialect-audit`. Some exclusions are surely deliberate (`test:e2e:ui` is interactive, `audit:tags:prod` hits production) but that is nowhere written down, so "not in CI" and "deliberately not in CI" are indistinguishable. **Suggested fix: a guard asserting every `test:*` script appears in `test.yml` or in a commented allowlist.** Deciding which of the 38 are deliberate is a human call and has not been made.
3. **Confirm light `--accent-violet`** (`#6D28D9` proposed, unconfirmed). **This now blocks SP5 phase 2** — the Solutions tab header uses it and screen `19` cannot ship without it. Nominally SP7's; whoever gets there first should settle it.
4. **`docs/sp2-handoff` (`293872b`) is still stranded** — 1 commit, never pushed, no PR, laptop-only.
5. **Publish `analyst-interview-prep`.** A human decision, still not made. Until then only ADMIN/MODERATOR see the reader and the sidebar's track-progress block renders nothing.
6. **Decide on a `main → production` release.** 133 commits behind, and `main` will keep drifting as SP4/SP5/SP7 land.
7. **`notFound()` returns HTTP 200 app-wide** — Next commits the status before the throw. Every page-level not-found test asserts the body instead. Pre-existing; understand it before writing new route tests.
8. **`check:token-parity` cannot catch a missing Tailwind utility.** SP5 phase 1 ships `check:theme-utilities` to close this. If SP5 stalls, the guard is independently useful and worth lifting out.
9. **~75 stale local branches.** Most are already merged via squash, so "N commits ahead of main" does not mean stranded work — `docs/sp2-handoff` and `docs/sp5-workspace-spec` are the two known-genuine ones. A prune is overdue but needs care to tell the two cases apart.
10. **SP2 has no `docs/ROADMAP.md` entry** — SP3 sits directly above SP1 there. Fix before generating release notes from that file.
11. Smaller SP3 residue: mobile sign-in nudge lacks `print:hidden`; `LessonAsideRail`'s `activeSlug` prop is never passed so the TOC active-highlight branch is dead; two unlabelled `complementary` landmarks on the reader; the two rails gate responsiveness differently.

---

## Where the detail lives

- **SP5 spec** `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md` — decisions, data model, the three questions it answered on its own authority
- **SP5 plan** `docs/superpowers/plans/2026-08-11-sp5-workspace.md` — 19 tasks, 4 phases, the capability inventory
- SP3 spec/plan `2026-08-08-sp3-lesson-reader-*.md`; SP2 spec/plan `2026-08-06-console-shell-tokens-*.md`
- PR bodies #184, #185, #195 — full Verified / Not-yet-verified lists
- Design bundle `~/Downloads/design_handoff_learning_platform 2/` (local, uncommitted). SP5: README `4a`/`6a` + screenshots `09`, `10`, `19`. SP4: `03`, `06`, `07`, `08`. SP7: `8a`, `20`–`22`.

## To resume

```bash
git checkout main && git pull --ff-only      # expect 22c197e or later
npm run test:console-nav                     # 51 pass
npm run test:lesson-nav                      # 27 pass  (now in CI)
npm run test:reading-progress                # 17 pass  (now in CI)
npm run test:scroll-restoration              # 7 pass
npm run check:token-parity                   # exit 0
```

All five verified green on 2026-08-11 under Node 26. **Judge them by exit code, not by grepping for `# pass`.**

Then push `docs/sp5-workspace-spec`, and start SP5 phase 1 — three tasks, no schema change, no design ambiguity left in it.
