# Handoff — SP3 (lesson reader) implemented on a branch, not yet reviewed as a whole or merged

## TL;DR

All 16 tasks of the SP3 plan are implemented and individually reviewed on `feat/sp3-lesson-reader` — 37 commits, 32 files, +5057/−107. The lesson reader renders SP1's 17 authored lessons for the first time.

**Nothing is merged and the branch is not pushed.** Three steps remain: the Task 16 review, the whole-branch review, and the PR. See [To resume](#to-resume).

**Read [Environment traps](#environment-traps-read-before-running-anything) before running any command.** The machine's `node` is currently broken.

---

## Where things stand

### Branch `feat/sp3-lesson-reader` (`d73f416`)

Cut from `docs/sp3-lesson-reader`, which carries the spec (`b44c34a`) and plan (`8170cc9`), so both ride in the same PR — SP2's pattern.

| | |
|---|---|
| Tasks implemented | 16 / 16 |
| Tasks task-reviewed | 15 / 16 (Task 16's review was dispatched but never ran) |
| Whole-branch review | **not run** |
| Pushed | **no** |
| PR | **not created** |

### What is done and verified

- **Route:** `/learn/tracks/[slug]/[lessonSlug]` — a focus mode. The 270px curriculum rail replaces the console sidebar under a 48px header, with a 250px contents rail.
- **Landmark audit passed live in Chrome** (Task 13): `header` 1 / `banner` 1 / `main#main-content` 1 with `tabIndex=-1` / `h1` 1 / `aria-current="page"` 1, `#app-scroll` the sole scroller, and the AX tree showing `banner` and `main` as siblings. `/practice` still has 1 banner + 1 main + 1 contentinfo.
- **Responsive verified with measured numbers** at 1440 / 1200 / 390 (Task 15), in **light** theme.
- **Unit suites:** `test:lesson-nav` 23, `test:reading-progress` 12, `test:console-nav` 51 (was 41 — widened, closing SP2 follow-up #4), `test:scroll-restoration` 7, `test:curriculum-actions` 20.
- **`tests/e2e/lesson-reader.spec.ts`** — 8 tests, observed passing, with a deliberate-break check confirming they bite.

### Sub-project status

| | Depends on | Status |
|---|---|---|
| SP1 Curriculum spine | — | merged |
| SP2 Tokens + shell | — | merged |
| SP3 Lesson reader | SP1 + SP2 | **implemented, unmerged** |
| SP4 Index screens | SP1 + SP2 | ready |
| SP5 Workspace | SP1 + SP2 | ready |
| SP6 Home + mobile | SP3–SP5 | blocked |
| SP7 Admin redesign | SP1 + SP2 | ready |

---

## To resume

```bash
export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"   # REQUIRED — see traps
cd /Users/anchitgupta/Documents/Github/datalearn
git checkout feat/sp3-lesson-reader                          # expect d73f416
node --version                                               # must print v22.21.0

npm run test:lesson-nav && npm run test:reading-progress \
  && npm run test:console-nav && npm run test:scroll-restoration
npm run check:token-parity
npx tsc --noEmit
```

Then, in order:

1. **Review Task 16** — `tests/e2e/lesson-reader.spec.ts`, the `CLAUDE.md` / `ROADMAP.md` edits, and the follow-up added to the spec. Commits `bd74968` and `d73f416`. This is the only task that never got its review.
2. **Whole-branch review** on the most capable model, over `git merge-base main HEAD`..`HEAD`. Point it at the deferred-minor and parked lines in `.superpowers/sdd/2026-08-08-sp3-lesson-reader/progress.md`.
3. **Push and open the PR** with `gh pr create --base main`. The repo default is `production`; a forgotten flag deploys unfinished work live.
4. **Close PR #168** with a comment pointing at the SP3 spec. Its intent was absorbed (body line-height, 450 weight, softened body colour, scrollable TOC, tabular-nums percentage), re-expressed against SP2's graphite tokens. Its `globals.css` hunk targeted the pre-SP2 palette and was not carried over. **This was deliberately left for a human to trigger.**

The ledger at `.superpowers/sdd/2026-08-08-sp3-lesson-reader/progress.md` is the authoritative record — it survives compaction and names every commit.

---

## Decisions locked (don't relitigate)

- **New curriculum route, shared body.** The topic route `/learn/[topicSlug]/[articleSlug]` keeps its single-column layout; `LessonBody` is shared so both stay typographically identical. The topic URL is canonical; the reader emits `rel="canonical"` at it.
- **The module is not in the URL.** The `04-` breadcrumb prefix derives from `position` at render time, per the schema comment on `Module.slug`. An article in two modules of one track resolves to the **lowest module position**.
- **DRAFT tracks render for ADMIN or MODERATOR only**, behind a banner, matching the gate `app/admin/layout.tsx` already applies. Publishing stays a deliberate human act and **was not done**.
- **`#app-scroll` remains the single scroll container.** The rails are sticky with their own overflow. `MainScrollRestoration` is untouched.
- **`ConsoleChrome` now owns `#app-scroll`, `<main>` and `<Footer>`** — moved out of `app/layout.tsx`. Focus routes get the scroll container only and supply their own header/main pair. This is what keeps `banner` legal.
- **Blocks with no data were omitted, not faked:** the "Asked at" company chips, the per-problem pass rate, and the "Interview-critical" chip have no backing field. The query+result pair is mock content no lesson contains.
- **The interim module list on `/learn/tracks/[slug]` is deliberately not to spec** — SP4's Module screen replaces it. It exists so the reader is reachable at all; `TrackItem` has 0 rows.

---

## What review caught that the plan didn't

Eleven defects were caught before merge. **Six were in the plan itself** — they would have shipped looking like working software.

| Defect | Consequence if shipped |
|---|---|
| `import { Footer }` into a client component | Build failure — `Footer` is an async server component. Threaded as a slot instead. |
| **`text-text` — a class that generates nothing** | No `--color-text` in `@theme inline`. Appeared **13×** across Tasks 7 and 9–14. |
| **`text-primary-fg` — same bug, different name** | The header's primary CTA label fell back to inherited colour on a bright green fill. |
| **`initialPercent` never re-read** | React honours a `useState` initial arg once. Lesson→lesson navigation leaked the previous lesson's max, and the monotonic guard then **permanently blocked** the new lesson's progress. After one completed lesson, every subsequent one was uncompletable. |
| `stripLeadingH1`'s `^\s*` | Also matched a CommonMark indented code block's four-space indent, silently deleting its first line. |
| `LessonBody` missing a slot | Byline and tag chips rendered *above* the title on a live route. |
| `/signin` | Route doesn't exist; it's `/auth/signin`. |
| Rail decided "current" by raw slug | A cross-listed article marked **two** links `aria-current="page"` and lit two module headers. |
| `role="dialog"` with no focus management | Announced "dialog", let users Tab straight out. Fixed by dropping the false contract. |
| Focus-return in effect cleanup | `useEffect` cleanup is passive and flushes after paint; anchor navigation is synchronous. Tapping a TOC entry scrolled you to your heading, then yanked focus to a footer button. |
| **Rails never stuck; chrome painted one viewport** | Backgrounds paint the border box, not the overflow. `<main>`'s surface stopped after `100dvh−3rem` of a ~5,300px article. Near-invisible in dark (`#0E0E11` vs `#111116`) — **a visible seam in light**. Fixed by removing one `min-h-0`. |

**Two lessons worth carrying into SP4–SP7:**

1. **Check the theme you didn't build in.** Two defects were invisible in dark and obvious in light. Every visual verification should switch themes before claiming a pass.
2. **A paint probe that walks up from `elementFromPoint` to the nearest non-transparent ancestor will report an element's *declared* background even where its box no longer reaches.** It produced a false pass on the chrome bug above. What actually settled it was a neighbouring column hitting bare `BODY`, plus screenshots.

---

## Environment traps (read before running anything)

**The Homebrew `node` is broken machine-wide.** It broke mid-session on 2026-08-09:

```
dyld: Library not loaded: /opt/homebrew/opt/simdjson/lib/libsimdjson.31.dylib
```

A `brew` upgrade repointed `/opt/homebrew/opt/simdjson` at 4.6.6, which ships `.33`, while node 25.8.1 was built against `.31`. The `.31` dylib still exists under `Cellar/simdjson/4.4.0/`. `node`, `npm` and `npx` all fail.

- **Fix:** `brew reinstall node`.
- **Workaround used throughout:** `export PATH="$HOME/.nvm/versions/node/v22.21.0/bin:$PATH"`.

**Node 22's test runner emits TAP (`# pass 23`), not node 25's spec format (`ℹ pass 23`).** A grep written for the old format matches nothing and exits 1 — indistinguishable from a test failure. Read the actual output.

**A stale `next dev` (PID 10592, started Aug 8) holds this directory's dev-server lock,** so `npm run dev` refuses to start. It was deliberately left running. Use `npm run start -- -p 3005` against a build instead.

**`.env.production` ships an empty `AUTH_SECRET`** that shadows the real one under `next start`, silently breaking auth — the same class of trap as commit `96cd285`. A present-but-empty variable still counts as set.

**`.env.production.local` was renamed to `.env.production.local.disabled`** (SP2 handoff follow-up #1). Still gitignored, reversible with `mv`.

**A stale `authjs.session-token` makes Auth.js emit a clearing `Set-Cookie` that wipes a freshly-set replacement.** Set the cookie *after* the first request with the dead token.

**`npx eslint` is broken repo-wide** — `eslint-plugin-react` throws at rule-load time under ESLint 10.4.0. Pre-existing, reproduces on untouched files. The new e2e spec is therefore not lint-verified locally; CI is the first real check.

**`rg` is not on `sh`'s PATH here.** Verify guard scripts under `env -i PATH=/usr/bin:/bin /bin/sh -c '...'`.

---

## Open follow-ups (priority order)

1. **`check:token-parity` cannot catch a missing Tailwind utility.** It diffs `:root` against `.light` and never inspects `@theme inline`, where the variable→utility mapping lives. **Both dead classes above passed it cleanly.** A guard asserting every `--color-<name>` referenced by a `text-`/`bg-`/`border-` utility actually exists in `@theme inline` would have caught both. Already recorded in the spec's follow-up list (`d73f416`).
2. **Confirm or replace light `--icon-done`** (`#3F7D68`). Proposed, unconfirmed — the design handoff's light table omits the role. Same status as `--accent-violet`.
3. **`notFound()` returns HTTP 200 app-wide**, including for nonexistent paths — Next's streaming commits the status before the throw. Every page-level not-found test in this repo asserts the body instead. Pre-existing; worth understanding before writing new route tests.
4. **Two unlabelled `complementary` landmarks** on the reader — the aside rail plus a `MarkdownRenderer` callout `<aside>`. Pre-existing renderer behaviour.
5. **The mobile sign-in nudge lacks `print:hidden`**, so a signed-out print includes the "Not signed in" card. This repo has a printable-pages guard.
6. **`LessonAsideRail`'s `activeSlug` prop is never passed**, so the TOC active-highlight branch is dead. Per plan, but it will look like a bug to the next reader.
7. **The two rails gate responsiveness differently** — `CurriculumRail` via a `className` at the call site, `LessonAsideRail` internally. Three files apart.
8. **SP2 has no `docs/ROADMAP.md` entry.** SP3 now sits directly above SP1. Decide before generating release notes from that file.
9. **Publish `analyst-interview-prep`.** Deliberately not done — it is a human decision. Until then only ADMIN/MODERATOR can see the reader.
10. **`docs/sp2-handoff` (`293872b`) is still stranded** — committed locally, never pushed, no PR. It exists only on this laptop.

---

## Where the detail lives

- Spec: `docs/superpowers/specs/2026-08-08-sp3-lesson-reader-design.md`
- Plan: `docs/superpowers/plans/2026-08-08-sp3-lesson-reader.md` (2,541 lines, 16 tasks — amended 8× during execution as reviews found plan defects)
- **Ledger: `.superpowers/sdd/2026-08-08-sp3-lesson-reader/progress.md`** — per-task outcomes, every deferred minor, every ruling. Gitignored, so it lives only on this machine.
- Per-task reports and review packages: same directory, `task-N-report.md` and `review-<base>..<head>.diff`.
- Design source of truth: `~/Downloads/design_handoff_learning_platform 2/README.md` §6 "Lesson reader", screenshots `05`, `06`, `15`, `18`. Local to this machine, not committed.
