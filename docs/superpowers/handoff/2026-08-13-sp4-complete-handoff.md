# Handoff — SP4 complete; five of seven done; only SP6 and SP7 remain

> **Supersedes [`2026-08-12-sp5-complete-handoff.md`](./2026-08-12-sp5-complete-handoff.md).** Its *Environment* section is still accurate and is carried forward with two additions. Its release-ordering finding is unchanged and now more urgent.

## TL;DR

**SP4 is merged** — PR #202, `714f9d3`, 19 commits, 41 files, **zero schema changes**. Practice catalog, Tracks index, Track detail and a new Module screen.

**Five of seven sub-projects are done**: SP1, SP2, SP3, SP4, SP5. **SP6 is now unblocked** (it needed SP4 + SP5). SP7 was never blocked.

**`main` is 183 commits ahead of `production`** and none of it is live.

**Two risks carried out of SP4, both needing a human:**
1. A production track with `TrackItem` rows and no `Module` rows would look broken — "No lessons yet" on the index, a full study sequence on its own page. Unverifiable from a dev machine; **check before the release**.
2. **CI has no curriculum data at all.** `seed-analyst-track.ts` is local-only and absent from `test.yml`, so every curriculum test seeds its own fixture — and the workspace panel's module grouping, shipped in SP5, has never run in CI.

---

## Where things stand

### `main` (`714f9d3`)

Clean. SP1 + SP2 + SP3 + SP4 + SP5. `test.yml` now has 33 verification steps, 13 of them from the redesign sub-projects.

| | Depends on | Status |
|---|---|---|
| SP1 Curriculum spine | — | **merged** (#182) |
| SP2 Tokens + shell | — | **merged** (#184) |
| SP3 Lesson reader | SP1 + SP2 | **merged** (#185) |
| SP5 Workspace | SP1 + SP2 | **merged** (#197–#200) |
| **SP4 Index screens** | SP1 + SP2 | **merged** (#202) |
| SP6 Home + mobile | SP4 + SP5 | **unblocked** |
| SP7 Admin redesign | SP1 + SP2 | **ready** |

**Recommended next: the release, not SP6.** See below — it now gates a feature three sub-projects have paid for, and the gap grows with every merge.

---

## What SP4 shipped

Spec `docs/superpowers/specs/2026-08-13-sp4-index-screens-design.md`, plan `docs/superpowers/plans/2026-08-13-sp4-index-screens.md` (11 tasks, 4 phases).

- **`getCatalogProblems`** (`lib/practice/catalog-read.ts`) serves both the catalog and the workspace problems panel — one definition of "a problem in a list".
- **`lib/practice/catalog-model.ts`** — facets, filters, three sorts, pure. The load-bearing rule: a group's counts ignore its own selection but honour every other group's, or the rail tells the learner there is nothing left to pick.
- **Module screen** at `/learn/tracks/<track>/modules/<module>` — 5 segments deliberately, with no module index, because `isFocusRoute` claims any 4-segment path under `learn/tracks`.
- **`lib/learn/tracks-read.ts`** — per-user track summaries, bounded by relation depth rather than track count.
- **`TrackItem` study sequence kept as a fallback** on the track detail.

### The redesign's own suites in CI (13 of test.yml's 33 steps)

`console-nav` 62 · `catalog-model` 19 · `module-model` 12 · `tracks-model` 4 · `problems-panel` 25 · `pass-rate` 11 · `approach-sort` 8 · `lesson-nav` 27 · `reading-progress` 17 · `scroll-restoration` 7 · `approaches` 17 (DB) · `theme-utilities` 7 + guard · `verify:pass-rate`.

Plus Playwright: 126 tests, of which `learn-csp` fails locally and passes in CI.

---

## Decisions locked — SP4

| Decision | Choice |
|---|---|
| Scope | Practice + Module + Tracks. The Learn hub (`/learn`) is **not** in SP4 |
| Unbacked design blocks | **Omit all** — no `Track.kind` filter, no authored module outcomes. Zero migrations |
| `TrackItem` | **Fallback**, not removed. Production still runs the old tracks feature |
| Module route | 5 segments, and **no module index** |
| Catalog filter state | Local, not URL-synced |
| Mobile catalog | Design's fixed grid + horizontal scroll. No bespoke mobile layout — SP6 owns that |

---

## What the review layers caught

Each task was reviewed individually, then the whole branch was reviewed once. The layers caught different classes of defect, and that is the argument for keeping both.

**Per-task reviews found:** every tag and company rendering as a raw slug (`recursive-cte`, `stripe`) across rows *and* facets; `/practice/tags` orphaned by the rebuild; the module hero lifted out of the spec's two-column grid; a rollup counting unpublished problems so index and detail disagreed; a test fixture leaking users on a crash.

**The whole-branch review found what per-task review structurally could not:** the tracks index printing **"✓ Complete" beside a sub-100% percentage** — `resume` scans lessons, `percent` counts lessons *and* problems — while the detail page said "Continue module 01" for the same learner; staff seeing cards whose title link 404s; and **catalog search silently narrowed** from title-or-description to title-only.

**The scoped re-review found the fix wave's own regression:** `getTrackBySlug` had gained a caller-supplied `allowDraft` on a `"use server"` export, moving an authorization boundary into the caller. Fixed in `de338b0` by resolving the role from `auth()` inside the action, matching `getTrackCurriculum`.

**Two plan errors worth recording**, both found by implementers rather than assumed:

- The plan claimed the summaries read was **"three queries"**. True at the Prisma-call level, false at the SQL level (6 anonymous / 8 signed-in) because Prisma's default relation strategy issues one statement per relation level. The plan's own verification snippet counted SQL statements, so it would have failed a correct implementation. The goal — no N+1 as tracks are added — holds, verified by seeding a second track and watching the count stay flat.
- The plan's capability inventory listed the **`/` search shortcut** as an existing behaviour to preserve. It never existed: the old code had a `<Kbd>` hint and no listener. It works now for the first time.

---

## Environment

Unchanged from the SP5 handoff except where noted.

- **Local Node 26 / CI Node 20.** Different `node --test` output (`ℹ pass 51` vs `# pass 51`) and different available APIs — `fs.globSync` landed in Node 22. **Judge suites by exit code.**
- **`tsconfig.json` type-checks `scripts/*.ts`** with `strict: true`.
- **Playwright reuses a running server.** When changing `DATABASE_URL`, `lsof -ti :3100 | xargs kill -9` first.
- **`npm run test:e2e` serves the last `npm run build`.** Rebuild before testing UI changes.
- **After any `prisma/schema.prisma` change run `npx prisma generate`.**
- **Editing an applied migration breaks Prisma's checksum** — add a second migration instead.
- **NEW: CI seeds no curriculum.** `test.yml` runs `prisma/seed.ts` and `seed:visual` only. Any test touching tracks, modules, lessons or checkpoints **must create its own fixture**. `tests/e2e/module.spec.ts` and `tracks.spec.ts` show the prefix-and-cleanup pattern.
- **NEW: the local `analyst-interview-prep` track is PUBLISHED** because an earlier session published it locally; the seed ships it DRAFT. Do not write a test that assumes either.
- `npm run dev` binds `.env.local`, a Neon branch that is neither local Postgres nor production.
- `gh` lacks `workflow` scope — any PR touching `.github/workflows/` needs a **web-UI merge**. PRs must pass `--base main`.
- `tests/e2e/learn-csp.spec.ts` fails locally, passes in CI. Environmental.
- The repo-wide `lint` script crashes (`eslint-plugin-react` / ESLint incompatibility). Pre-existing.

---

## Open follow-ups (priority order)

1. **Decide the `main → production` release.** 183 commits. It gates publishing `analyst-interview-prep`, which gates the module grouping, the lesson context bar, the Comes-from card and now the whole SP4 curriculum surface from ever being seen by a learner. `production` has **no curriculum spine at all** — `lib/curriculum-read.ts` and the reader are absent from that branch — so publishing the track first would mark it live for a deployment that cannot render it.
2. **Before that release, check production for a track with `TrackItem` rows and no `Module` rows.** If one exists it will show "No lessons yet" on the new index while its detail page renders a full study sequence. Unverifiable from a dev machine — the credentials are Vercel-only.
3. **Decide whether `seed-analyst-track.ts` belongs in CI.** Adding it would give the curriculum screens real coverage instead of per-test fixtures, at the cost of a slower seed step. This is part of follow-up 4's decision.
4. **The CI gap is ~38 scripts.** Auditing all `test:`/`check:`/`audit:` scripts against `test.yml` still leaves ~38 unreferenced — ~15 contest suites, 7 upload/asset suites, and a dozen others. Some exclusions are surely deliberate but that is nowhere written down. **Suggested fix: a guard asserting every `test:*` script appears in `test.yml` or a commented allowlist.** Needs a human ruling first.
5. **Approaches have no vote controls** (SP5). Score renders; `DiscussionVote` keys on `commentId` so voting works structurally, but there is no arrow to click.
6. **No e2e covers the tracks index card itself** beyond its zero-state, and the module branch of the track detail got coverage only in the final fix wave.
7. **Confirm light `--accent-violet`** (`#6D28D9`, still marked "SP7 to confirm").
8. **`docs/sp2-handoff` (`293872b`) is still stranded** — 1 commit, never pushed.
9. **`notFound()` returns HTTP 200 app-wide.** Assert on the body, never the status.
10. **Pass-rate counters drift** when a `User` is deleted — repair with `npm run verify:pass-rate -- --fix`.

---

## Where the detail lives

- SP4 spec + plan: `docs/superpowers/specs/2026-08-13-sp4-index-screens-design.md`, `docs/superpowers/plans/2026-08-13-sp4-index-screens.md`
- PR #202 — full Verified / Not-yet-verified lists, including both carried risks
- SP5: `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md`; SP3: `2026-08-08-sp3-lesson-reader-design.md`; SP2: `2026-08-06-console-shell-tokens-design.md`
- Design bundle `~/Downloads/design_handoff_learning_platform 2/` (local, uncommitted). SP6: screenshots `01`, `02`, `14`–`16`. SP7: `8a`, `20`–`22`.

## To resume

```bash
git checkout main && git pull --ff-only      # expect 714f9d3 or later
npm run test:console-nav                     # 62 pass
npm run test:catalog-model                   # 19 pass
npm run test:module-model                    # 12 pass
npm run test:tracks-model                    # 4 pass
npm run test:problems-panel                  # 25 pass
npm run check:theme-utilities                # 7 fixtures + guard, exit 0
npm run check:token-parity                   # exit 0
```

All verified green on 2026-08-13 under Node 26. **Judge by exit code, not by grepping for `# pass`.**

Then take the release decision — it unblocks two more things — or start SP6, which needs nothing else now.
