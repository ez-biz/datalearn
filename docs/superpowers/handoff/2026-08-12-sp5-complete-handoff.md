# Handoff — SP5 complete; four of seven sub-projects done; the release now blocks a feature

> **Supersedes [`2026-08-11-sp5-specced-blockers-cleared-handoff.md`](./2026-08-11-sp5-specced-blockers-cleared-handoff.md).** Its top follow-up (push the SP5 spec branch) is done, and SP5 went from specced to shipped. Its *Environment* section is still accurate and is carried forward.

## TL;DR

**SP5 is complete and merged.** Four PRs in one day — #196 (spec + plan), #197 (shell), #198 (workspace), #199 (pass rate), #200 (approaches) — all with CI green on `main`. The workspace at `/practice/<slug>` is now the four-column console view from design `4a`.

**Four of seven sub-projects are done**: SP1, SP2, SP3, SP5. SP4 and SP7 are ready; SP6 needs SP4.

**The most important finding of the session is an ordering one.** Publishing `analyst-interview-prep` cannot come before the release. `production` has **no curriculum spine at all** — `lib/curriculum-read.ts`, `lib/curriculum-progress.ts` and the entire reader are absent from that branch. Publishing now would mark a track live for a deployment with no code to render it.

**`main` is 161 commits ahead of `production`.** The release is no longer just drift management: it now gates a feature three sub-projects have already paid for.

---

## Where things stand

### `main` (`279f2ce`)

Clean. SP1 + SP2 + SP3 + SP5, plus six new CI suites.

| | Depends on | Status |
|---|---|---|
| SP1 Curriculum spine | — | **merged** (#182) |
| SP2 Tokens + shell | — | **merged** (#184) |
| SP3 Lesson reader | SP1 + SP2 | **merged** (#185) |
| **SP5 Workspace** | SP1 + SP2 | **merged** (#197–#200) |
| SP4 Index screens | SP1 + SP2 | **ready** |
| SP7 Admin redesign | SP1 + SP2 | **ready** |
| SP6 Home + mobile | SP4 + SP5 | needs SP4 only |

**Recommended next: SP4.** It is the last thing blocking SP6, and it replaces the deliberately off-spec module list on `/learn/tracks/<slug>` that SP3 shipped as a stopgap.

---

## What SP5 shipped

Spec `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md`, plan `docs/superpowers/plans/2026-08-11-sp5-workspace.md` (19 tasks, four phases).

- **`isAppRoute`** — a third shell mode beside `isFocusRoute`. Sidebar kept, footer dropped, `#app-scroll` clamped at `lg`. A test asserts the two predicates are mutually exclusive over every real route.
- **Nine components** replacing `ProblemPanel.tsx` (525 lines) and `SqlPlayground.tsx` (451), with pure logic in `lib/workspace/{problems-panel-model,checkpoint-context,pass-rate,approach-sort}.ts`.
- **Pass rate** as denormalized `attemptCount`/`acceptedCount`, incremented in the submission transaction.
- **Community approaches** as `DiscussionComment.kind = APPROACH`, one per user per problem via a partial unique index.

### Test suites added, all wired into CI in the PR that added them

| Suite | Tests |
|---|---|
| `test:problems-panel` | 24 |
| `test:pass-rate` | 11 |
| `test:approach-sort` | 8 |
| `test:approaches` *(DB)* | 17 |
| `check:theme-utilities` | 7 fixtures + the guard |
| `verify:pass-rate` | counter drift check |

Plus `tests/e2e/workspace.spec.ts` and `workspace-capabilities.spec.ts`.

---

## Decisions locked — don't relitigate

| Decision | Choice |
|---|---|
| Mobile workspace | SP6's, not SP5's |
| Pass rate | Denormalized counters, submission-level |
| Approaches | On `DiscussionComment` via `kind`, not new models |
| Posting gate | **Any signed-in user**, mitigated by a computed `verified` mark |
| Approach cardinality | One per user per problem, partial unique index |
| Results-pane tab | Named **Runs** (session-local), not History |
| "All problems" button | In `WorkspaceLayout`, not the context bar — the bar is conditional |

---

## Recurring patterns — all three recurred again

**1. Capability lost in a deletion.** Two more instances. Rewiring "share approach" made `setDiscussionPrefill` unreachable, silently killing the ability to quote a query into the discussion thread — **caught by an existing e2e test**, the first time a test rather than a review found it. And approaches reached the moderation queue with `bodyMarkdown` set to a label, so a reported approach would have been judged with its SQL invisible to the moderator.

**2. New tests that never run.** Held the line: all six suites got their `test.yml` line in the same PR.

**3. Verification aimed slightly off the real question.** Three instances, all caught:
- A DuckDB-fallback fixture using `INSERT ... SELECT` — which `parseSchema` reads fine, so the test passed green without exercising the fallback at all. Only 839ms of suspicious speed gave it away. Now a CTAS, with `parseSchema()` run directly to confirm it returns `null`.
- A first-visit collapsible rule that never opened, because `useState(defaultOpen)` latched before the `localStorage` read resolved.
- The pass-rate backfill, verified by recomputing and comparing values — and the verifier itself proved able to fail (a deliberate +7 skew) before being trusted.

**New rule worth keeping: prove the check can fail before trusting it green.**

---

## Environment

- **Local Node 26 / CI Node 20.** They disagree on `node --test` output (`ℹ pass 51` vs `# pass 51`) and on which APIs exist — `fs.globSync` landed in Node 22 and would pass locally, fail in CI. **Judge suites by exit code.**
- **`tsconfig.json` type-checks `scripts/*.ts`** with `strict: true`. Test helpers need real types.
- **Playwright reuses a running server.** When changing `DATABASE_URL`, `lsof -ti :3100 | xargs kill -9` first, or you will seed one database while the server reads another.
- **`npm run test:e2e` serves the last `npm run build`.** Rebuild before testing UI changes, or you will debug a bug you already fixed.
- **After any `prisma/schema.prisma` change, run `npx prisma generate`.** `migrate dev` did not always regenerate this session; the symptom is `PrismaClientValidationError` naming a field you just added.
- **Editing an applied migration breaks Prisma's checksum.** Add a second migration instead — that is why the pass-rate backfill is its own file.
- `npm run dev` binds `.env.local`, which points at a Neon branch (`ep-cool-flower`), **not** local Postgres and not production. Prefix `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn'` for local data.
- `gh` lacks `workflow` scope: any PR touching `.github/workflows/` needs a **web-UI merge**. PRs must pass `--base main`.
- **`tests/e2e/learn-csp.spec.ts` fails locally and passes in CI.** Environmental; not worth chasing.
- **The repo-wide `lint` script crashes** (`eslint-plugin-react` / ESLint incompatibility in `eslint-config-next`, exit 2). Pre-existing, reproduces on individual files, unrelated to any branch.

---

## Open follow-ups (priority order)

1. **Decide the `main → production` release.** 161 commits. **This now blocks publishing the track**, which blocks the module grouping, `n/m` fractions, lesson context bar and Comes-from card from ever appearing for a learner. Caveats: SP4/SP6/SP7 are unbuilt so parts of the nav render "soon" chips, and `production`'s database would take several migrations on the first deploy.
2. **Then publish `analyst-interview-prep`.** Still DRAFT. Verified locally that publishing flips a learner's panel from "Not in a track 0/23" to real module grouping.
3. **Approaches have no vote controls.** Score renders; `DiscussionVote` keys on `commentId` so voting works structurally, but there is no arrow to click. Not feature-complete against screen `12`.
4. **The CI gap is 40 scripts, not 6.** Auditing all `test:`/`check:`/`audit:` scripts against `test.yml` still shows ~38 unreferenced — ~15 contest suites, 7 upload/asset suites, and a dozen others. Some exclusions are surely deliberate but that is nowhere written down. **Suggested fix: a guard asserting every `test:*` script appears in `test.yml` or a commented allowlist.** Needs a human ruling first.
5. **Confirm light `--accent-violet`** (`#6D28D9`, marked "SP7 to confirm" in `globals.css`). Used by the Solutions tab's sparkles mark.
6. **Light theme unreviewed** for the workspace against screenshot `19`.
7. **`docs/sp2-handoff` (`293872b`) is still stranded** — 1 commit, never pushed, laptop-only.
8. **`notFound()` returns HTTP 200 app-wide.** Pre-existing; understand it before writing route tests.
9. **~75 stale local branches.** Most merged via squash, so "N commits ahead" does not mean stranded.
10. **Pass-rate counters drift** when a `User` is deleted — submissions cascade, counters do not. Detected by `verify:pass-rate`, repaired with `--fix`.

---

## Where the detail lives

- SP5 spec + plan: `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md`, `docs/superpowers/plans/2026-08-11-sp5-workspace.md`
- PR bodies #197–#200 — full Verified / Not-yet-verified lists, including everything deliberately left unproven
- SP3 spec `2026-08-08-sp3-lesson-reader-design.md`; SP2 spec `2026-08-06-console-shell-tokens-design.md`
- Design bundle `~/Downloads/design_handoff_learning_platform 2/` (local, uncommitted). SP4: screenshots `03`, `06`, `07`, `08`. SP7: `8a`, `20`–`22`. SP6: `14`–`16`.

## To resume

```bash
git checkout main && git pull --ff-only      # expect 279f2ce or later
npm run test:console-nav                     # 61 pass
npm run test:problems-panel                  # 24 pass
npm run test:pass-rate                       # 11 pass
npm run test:approach-sort                   # 8 pass
npm run check:theme-utilities                # 7 fixtures + guard, exit 0
npm run check:token-parity                   # exit 0
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:approaches   # 17 pass
```

All verified green on 2026-08-12 under Node 26. **Judge by exit code, not by grepping for `# pass`.**

Then either take the release decision (follow-up 1, which unblocks two more), or start SP4 — the last thing standing between SP6 and its dependencies.
