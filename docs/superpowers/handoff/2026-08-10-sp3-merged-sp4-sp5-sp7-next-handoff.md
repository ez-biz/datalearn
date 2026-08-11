# Handoff — SP3 merged; SP4, SP5 and SP7 unblocked; local `node` is broken

> **Supersedes [`2026-08-09-sp3-lesson-reader-handoff.md`](./2026-08-09-sp3-lesson-reader-handoff.md)**, which was written mid-review and states that SP3 "is not merged and the branch is not pushed". That is no longer true. Its *Decisions locked*, *What review caught* and *Environment traps* sections are still accurate and are carried forward or referenced below.

## TL;DR

SP3 merged to `main` as PR #185 (merge commit `0591564`). Three of seven sub-projects are done. **SP4, SP5 and SP7 are all unblocked**; SP6 now waits only on SP4 + SP5.

**Resolved 2026-08-11: `node` is fixed** (`brew reinstall node` → `v26.7.0`, npm `11.19.0`). It had been linked against a simdjson Homebrew moved from `.31` to `.33`. All five resume checks now pass on the real runtime — see [Environment](#environment).

**Good news:** `.env.production.local` — the file that had e2e running against the production database with a blank `AUTH_SECRET` — is **gone** (renamed to `.env.production.local.disabled`). That trap is closed.

**New finding:** SP3 added 44 tests that **do not run in CI** (`test:lesson-nav`, `test:reading-progress`). This is the second time this exact gap has occurred; see [Recurring patterns](#recurring-patterns-worth-internalising). **Being fixed on this branch** — and an audit of all 60 `test:`/`check:`/`audit:` scripts against `test.yml` found the gap is far wider than SP3; see follow-up 11.

---

## Where things stand

### Production (`production`, `6031ac5`)
Old teal palette, old 64px navbar. **None of SP1, SP2 or SP3 is live.** `main` is **129 commits ahead**. Holding the release until the redesign is coherent was deliberate — but the gap is now large enough to be worth a conscious decision rather than drift.

### `main` (`406ff42`)
Working tree clean. Contains SP1 + SP2 + SP3 plus dependabot merges (#180, #183).

### Sub-project status

| | Depends on | Status |
|---|---|---|
| SP1 Curriculum spine | — | **merged** (PR #182) |
| SP2 Tokens + shell | — | **merged** (PR #184) |
| SP3 Lesson reader | SP1 + SP2 | **merged** (PR #185) |
| **SP4 Index screens** | SP1 + SP2 | **ready** |
| **SP5 Workspace** | SP1 + SP2 | **ready** |
| **SP7 Admin redesign** | SP1 + SP2 | **ready** |
| SP6 Home + mobile | SP4 + SP5 | blocked on two, not three |

**Recommended next: SP5 (workspace).** SP4 and SP7 are largely index/list screens; the workspace is the product's core loop and the last big structural piece. SP4 + SP5 together unblock SP6, so doing SP5 now keeps the critical path shortest. SP7 is genuinely parallel and can slot in anywhere.

---

## Environment

**Resolved 2026-08-11: `node` was broken, and is now fixed.** Every `npm`/`node` invocation died with `dyld: Library not loaded: .../libsimdjson.31.dylib` referenced from `node/25.8.1_1` — Homebrew had moved simdjson to `.33`. `brew reinstall node` fixed it; local is now **`v26.7.0` / npm `11.19.0`**. The nvm workaround (`export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"`) is no longer needed.

⚠️ **Still live, and now permanent: local is Node 26, CI is Node 20** (`.github/workflows/test.yml` pins `node-version: "20"`). The two emit different `node --test` output — Node 20/22 emit TAP (`# pass 51`), Node 25/26 emit `ℹ pass 51`. **Never grep test output to decide pass/fail; read the exit code.** A grep for `# pass` reports "no results" rather than a failure on the local runtime. This has already wasted a cycle once.

**Resolved since the last handoff:** `.env.production.local` is gone. It previously outranked `.env` under `next start`, supplying a production `DATABASE_URL` and an empty `AUTH_SECRET` (empty still counts as set), so every session resolved null and signed-in e2e tests silently rendered signed-out pages.

**Still live:** `npm run dev` binds to `.env.local`, which points at production Neon. Prefix `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn'` for local data.

**Still live:** `rg` is not on `#!/bin/sh`'s PATH here (it is only a zsh function). Verify guard scripts under `env -i PATH=/usr/bin:/bin /bin/sh -c '...'` — an interactive shell inherits the function and reports success CI does not reproduce.

**Still live:** never `next build` without `--webpack` (use `npm run build`); `gh` lacks `workflow` scope so any PR touching `.github/workflows/` needs a web-UI merge; PRs must pass `--base main` (default is `production`).

---

## What SP3 shipped

The reader lives at `/learn/tracks/[slug]/[lessonSlug]` and renders SP1's 17 authored lessons — the first time that content has been visible anywhere.

`components/learn/reader/`: `LessonHeader` (carries the `banner` landmark), `ReaderProgressProvider` (owns the scroll listener, the percent and the writes), `ReadingProgressBar`, `CurriculumRail`, `LessonBody` (shared with the topic article route so both stay typographically identical), `LessonAsideRail`, `ContentsSheet`, `CheckpointBlock`, `LessonPrevNext`, `LessonSignInNudge`, `lesson-nav.ts` (pure flattening + prev/next).

Plus `lib/reader-progress-write-queue.ts` and `components/layout/console/focus-route.ts`.

**The focus-route contract is the load-bearing architectural change.** `ConsoleChrome` now owns `#app-scroll`, `<main id="main-content">` and `<Footer>` — moved out of `app/layout.tsx`. `isFocusRoute()` decides which routes opt out of the console shell; the reader is currently the only one. Focus routes get the scroll container only and **must supply their own `<header>` + `<main>` pair**, because ARIA forbids `banner` inside `main`. Anything SP4/SP5/SP7 add that wants full-bleed chrome goes through this predicate.

### Test suites (all green — re-verified 2026-08-11 on the repaired Node 26 runtime, by exit code)

| Script | Tests | In CI? |
|---|---|---|
| `test:console-nav` | 51 | ✅ |
| `test:scroll-restoration` | 7 | ✅ |
| `check:token-parity` | — | ✅ |
| `check-no-palette-colors.sh` | — | ✅ |
| `check-shadcn-token-definitions.sh` | — | ✅ |
| **`test:lesson-nav`** | **27** | **added on this branch** |
| **`test:reading-progress`** | **17** | **added on this branch** |

`test:reading-progress` runs two files (`test-reading-progress.ts` + `test-reader-progress-persistence.ts`).

---

## Decisions locked (don't relitigate)

Carried from the SP3 handoff, all still current:

- **New curriculum route, shared body.** `/learn/[topicSlug]/[articleSlug]` keeps its single-column layout; `LessonBody` is shared. The topic URL is canonical; the reader emits `rel="canonical"` at it.
- **The module is not in the URL.** The `04-` breadcrumb prefix derives from `position` at render time. An article in two modules of one track resolves to the **lowest module position**.
- **DRAFT tracks render for ADMIN/MODERATOR only**, behind a banner. Publishing stays a human act and **has not been done** — so only admins can currently see the reader.
- **`#app-scroll` is the single scroll container.** Rails are sticky with their own overflow. `MainScrollRestoration` untouched.
- **Blocks with no backing data were omitted, not faked** — "Asked at" company chips, per-problem pass rate, "Interview-critical" chip.
- **The module list on `/learn/tracks/[slug]` is deliberately not to spec** — SP4's Module screen replaces it. It exists so the reader is reachable at all.

From SP2, still binding:

- Big-bang on `main`, hold production. Unbuilt nav destinations render disabled with a "soon" chip. Collapse state in a cookie, read server-side. Theme toggle in sidebar footer + rail footer + both mobile menus. `--panel-hover` is for `--panel` chrome only; content hover uses `--color-surface-hover`.

---

## Recurring patterns worth internalising

Three failure shapes have now repeated across SP2 and SP3. Expect them in SP4/SP5/SP7.

**1. Capability lost in a deletion.** SP2's whole-branch review found that deleting `Navbar.tsx` silently removed `ThemeToggle` (light mode unreachable everywhere), mobile `UserMenu` access (no sign-out below `lg`), and the only `banner` landmark (three e2e tests would have failed CI). None was visible to per-task review. **When deleting a component, diff what it provided against what replaces it.**

**2. New tests that never run.** SP2 shipped four guards wired to nothing; that was caught and fixed in its final review. SP3 then shipped two more suites — 44 tests — that are *still* not in CI. A test suite added to `package.json` is not covered until a line appears in `.github/workflows/test.yml`.

**3. Verification aimed slightly off the real question.** Recurring: a guard script that passed because `rg` wasn't found and the error was swallowed; a `getComputedStyle` check on a `<thead>` that reported a declared border CSS `border-collapse` then discards; a design-system mirror confirmed to *contain* a token without comparing its *value*. **"The check ran and was green" and "the thing is correct" are different claims.**

---

## Open follow-ups (priority order)

1. ~~**Wire `test:lesson-nav` and `test:reading-progress` into CI.**~~ **Done 2026-08-11 on `docs/sp3-merged-handoff`** — two steps added to `test.yml` after `test:console-nav`. Because it touches `.github/workflows/`, **the PR still needs a web-UI merge** (`gh` lacks `workflow` scope). Not protected until that merge lands.
2. ~~**`brew reinstall node`**~~ **Done 2026-08-11** — local runtime is `v26.7.0` / npm `11.19.0`.
3. **`check:token-parity` cannot catch a missing Tailwind utility.** It diffs `:root` against `.light` and never inspects `@theme inline`, where the variable→utility mapping lives. Two dead classes passed it cleanly during SP3. A guard asserting every `--color-<name>` used by a `text-`/`bg-`/`border-` utility exists in `@theme inline` would have caught both.
4. **Publish `analyst-interview-prep`.** Deliberately not done — a human decision. Until then only ADMIN/MODERATOR see the reader, and the sidebar's track-progress block renders nothing.
5. **Confirm or replace light `--icon-done` (`#3F7D68`) and light `--accent-violet` (`#6D28D9`).** Both proposed, unconfirmed; the handoff's light table omits those roles. SP7 owns the violet.
6. **`notFound()` returns HTTP 200 app-wide** — Next's streaming commits the status before the throw. Every page-level not-found test asserts the body instead. Pre-existing; understand it before writing new route tests.
7. **`docs/sp2-handoff` (`293872b`) is stranded** — 1 commit, never pushed, no PR. Exists only on this laptop.
8. **Decide on a `main → production` release.** 129 commits behind. `main` will keep drifting further as SP4/SP5/SP7 land one at a time.
9. Smaller SP3 residue: mobile sign-in nudge lacks `print:hidden`; `LessonAsideRail`'s `activeSlug` prop is never passed so the TOC active-highlight branch is dead; two unlabelled `complementary` landmarks on the reader; the two rails gate responsiveness differently (one via a call-site `className`, one internally).
10. **SP2 has no `docs/ROADMAP.md` entry** — SP3 sits directly above SP1 there. Fix before generating release notes from that file.
11. **The CI gap is much wider than SP3 — 38 more orphaned scripts.** Auditing all 60 `test:`/`check:`/`audit:` scripts in `package.json` against `test.yml` (the only workflow file) shows **40 are not referenced**; the two SP3 suites were just the two anyone had noticed. The scripts exist on disk and are not stubs. Largest cluster is **~15 contest suites** (`test:contest-*`, `test:custom-contests`, `test:contest-leaderboard`, …), then **7 upload/asset suites** (`test:uploads`, `test:upload-quota-race`, `test:asset-gc`, `test:admin-asset-delete*`, …), plus `test:directive-renderer`, `test:mermaid-sanitization`, `test:admin-audit-log`, `test:topic-lane`, `test:discussion`, `test:sql-validator-json-time`, `test:sql-engine-result-cap`, `test:sql-engine-runtime-controls`, `test:dialect-audit`. Some exclusions are surely deliberate (`test:e2e:ui` is interactive; `audit:tags:prod` hits production) — but that has never been written down, so "not in CI" and "deliberately not in CI" are indistinguishable today. **Suggested fix: a guard script asserting every `test:*` script appears in `test.yml` or in an explicit, commented allowlist.** That converts recurring pattern 2 from a thing people must remember into a thing CI enforces. Deciding which of the 38 are deliberate is a human call and was not made here.

---

## Where the detail lives

- SP3 spec `docs/superpowers/specs/2026-08-08-sp3-lesson-reader-design.md`, plan `docs/superpowers/plans/2026-08-08-sp3-lesson-reader.md`
- SP2 spec `docs/superpowers/specs/2026-08-06-console-shell-tokens-design.md`, plan `docs/superpowers/plans/2026-08-06-console-shell-tokens.md`
- Prior handoffs: `2026-08-09-sp3-lesson-reader-handoff.md` (mid-review, stale on merge status), and the SP2 handoff on the stranded `docs/sp2-handoff` branch
- PR bodies #184 and #185 — full Verified / Not-yet-verified lists
- `docs/design-system/colors_and_type.css` mirrors the live token contract
- Design handoff bundle `~/Downloads/design_handoff_learning_platform 2/` (local, not committed). For SP5 read the workspace sections and screenshots `09`, `10`, `16`, `19`; for SP4 the practice/module/tracks screens `03`, `06`, `07`, `08`; for SP7 section `8a` and `20`–`22`.

## To resume

```bash
git checkout main && git pull --ff-only      # expect 406ff42 or later
npm run test:console-nav                     # 51 pass
npm run test:lesson-nav                      # 27 pass
npm run test:reading-progress                # 17 pass
npm run test:scroll-restoration              # 7 pass
npm run check:token-parity                   # exit 0
```

All five verified green on 2026-08-11 (Node 26). Judge them by exit code, not by grepping for `# pass`.

For SP5, start with the brainstorming skill against the handoff README's workspace sections. Note that `4a` supersedes `3a` where they disagree — sidebar instead of top bar, no Schema tab, collapsible schema.
