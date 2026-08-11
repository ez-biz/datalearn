# SP5 — Workspace redesign

> Design spec. Status: agreed 2026-08-11. Implementation plan to follow.
>
> Sub-project 5 of 7 in the learning-platform redesign. Depends on SP1 (curriculum spine) and SP2 (tokens + console shell), both merged. Together with SP4 it unblocks SP6.

## What this is

The problem-solving workspace at `/practice/[slug]` — the product's core loop — rebuilt to the design handoff's section `4a` (screens `09`, `10`, `16`, `19`). `4a` supersedes `3a` wherever they disagree: a sidebar instead of a top bar, no Schema tab, collapsible schema.

Today the workspace is a two-column split: a tabbed problem panel on the left (`Description / Hints / Submissions / Discussion`) and the SQL playground on the right. The redesign makes it four columns — console sidebar, problems panel, problem panel, editor — adds a lesson context bar tying the problem back to the curriculum, promotes Solutions and Discussion to first-class tabs, and makes the schema collapsible so the editor can reclaim the space.

## Decisions locked

Made during brainstorming on 2026-08-11. Don't relitigate these without new information.

| Decision | Choice | Why |
|---|---|---|
| Mobile | **Out of scope.** Desktop + tablet down to `lg` (1024px) | SP6 is already scoped as "Home + mobile"; screen `16` goes there |
| Pass rate | **Build it.** Submission-level, denormalized counters | O(1) reads for a 412-row panel, exact, no cache invalidation |
| Community approaches | **Build them**, on the existing discussion subsystem | Inherits voting, reporting, moderation and per-problem modes |
| Approach posting gate | **Any signed-in user** | Chosen deliberately over an accepted-only gate; see the mitigation below |
| Approach cardinality | One per user per problem, editable and deletable | Assumption stated during design; not separately confirmed |
| Problems panel scope | Full published catalog; ungrouped problems last | Matches the "All problems · 412" header in screen `09` |
| Shell mode | **New `isAppRoute` predicate** beside `isFocusRoute` | Keeps the sidebar; avoids a second rendering path for it |
| Results-pane `History` tab | Renamed **Runs** — session-local run history | Resolves a name collision in the design; see below |

### The open posting gate, and its mitigation

Allowing any signed-in user to post an approach puts unverified SQL in the tab learners open to find the correct answer, beside the canonical solution. This was chosen with that trade-off stated. The design mitigates rather than re-gates:

- An approach is marked **verified** when its author has an `ACCEPTED` submission on that problem. Computed at read time, never stored — storing it goes stale the moment the author solves the problem after posting.
- Verified approaches sort above unverified ones **within the same score bucket**; score still leads.
- Unverified approaches carry a plain line: *not verified against the expected output*.
- The canonical `SolutionPanel` sits above the community list with its own gating untouched, so the editorial answer is never below user content.

## Scope

**In:** the four-column layout and its responsive behaviour to `lg`; the problems panel; the lesson context bar; the five-tab problem panel; collapsible schema and expected output; the editor toolbar, results pane and action bar; pass rate; community approaches; light theme (screen `19`).

**Out:** the mobile workspace (screen `16` — SP6); weak spots and streaks (SP6 per the curriculum spec); the `/practice` catalog screen (SP4); admin (SP7).

---

## 1. Shell and layout

### The predicate

`isAppRoute(pathname)` joins `isFocusRoute` in `components/layout/console/focus-route.ts`, in the same style — pure, no React or Next imports, so it unit-tests without a DOM. Segment-count discriminated, as `isFocusRoute` already is:

```ts
export function isAppRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)
    return segments.length === 2 && segments[0] === "practice"
}
```

`/practice/<slug>` is an app route; `/practice` — SP4's catalog — is not.

**The two predicates must never both return true.** A unit test asserts mutual exclusivity over a fixture list of every real route in the app. Three shell modes is one more than anyone can hold in their head reliably; the test is what makes it safe.

| Mode | `<main>` | Footer | Page scroll | Sidebar |
|---|---|---|---|---|
| normal | yes | yes | yes | yes |
| focus (`isFocusRoute`) | no — page supplies its own | no | yes | no |
| **app (`isAppRoute`)** | **yes** | **no** | **no at `lg`+, yes below** | **yes** |

The predicate itself is width-independent; only the CSS it drives is responsive. See below.

### ConsoleChrome

The shell root is already `flex h-dvh overflow-hidden`, so the viewport clamp exists. Only the inner container changes. On an app route `#app-scroll` becomes `overflow-y-auto lg:overflow-hidden` — scrolling below `lg`, clamped at `lg` and above — `<main id="main-content">` gains `lg:min-h-0`, and `footerSlot` is skipped at every width.

`<main>` stays. The workspace is not a focus route, does not supply its own `banner`, and the console sidebar remains the page's only one — so the ARIA constraint that forced the reader's header/main split does not apply here.

### This applies from `lg` up only

SP2 made the sidebar (`w-[236px]`) and rail (`w-14`) `lg:`-gated, with collapse driven by the server-read cookie rather than by viewport; below `lg` the shell swaps to `MobileTabBar` and `#app-scroll` carries `pb-14`. Since the mobile workspace is SP6, below `lg` the workspace keeps today's stacked, page-scrolling behaviour and `#app-scroll` stays scrollable with its tab-bar padding.

The footer is suppressed at **every** width. A workspace never wants one.

### Columns at `lg`+

Left to right: sidebar 236 or rail 56 (SP2's, untouched) · problems panel 296 · problem panel 400 · editor `flex-1`. Each column scrolls independently; the page itself never scrolls.

Between `lg` and 1280px the problems panel stops being a column and becomes an overlay drawer over the workspace, opened by the "All problems" button that screen `10` puts in the context bar.

### Persistence

- `dl:problems-panel` — open/closed, `localStorage`, beside the existing `dl:draft:<slug>`, `dl:dialect:<slug>` and `dl:query-timeout-ms`.
- `dl:seen:<slug>` — whether the learner has visited this problem before, which drives the collapsible default (§4). Written once on mount, after the initial open/collapsed decision has been read, so the first render of a first visit still sees it absent.
- Sidebar collapse stays on SP2's cookie. Two mechanisms deliberately: the sidebar must be correct on first paint to avoid a layout flash, whereas the problems panel lives inside a client tree that already hydrates.

### Lesson context bar

Spans the problem panel and editor columns, above both. Renders only when the problem has a `LessonCheckpoint` row — problems reached from the catalog with no curriculum link simply don't get one. Contents per `4a`: "← Back to lesson" in `primary`, a mono module/lesson breadcrumb, "Checkpoint 1 of 2", and a two-segment stepper of 22×5px bars.

---

## 2. Component decomposition

`ProblemPanel.tsx` is 525 lines with four tabs; adding a fifth tab, two collapsibles, a problems panel and a context bar to the existing files would push it past 900. The work gets `components/practice/workspace/`:

| New | Replaces / absorbs |
|---|---|
| `WorkspaceLayout.tsx` | the column grid and the <1280px overlay; owns `problemsPanelOpen` |
| `ProblemsPanel.tsx` | new — 296px list, filter input, Track order / Todo / Tags chips |
| `LessonContextBar.tsx` | new |
| `ProblemTabs.tsx` + `tabs/` | `ProblemPanel.tsx` → a ~80-line tab strip plus one file per tab |
| `tabs/DescriptionTab.tsx` | today's inline `DescriptionTab` + `SchemaOverview` |
| `tabs/HintsTab.tsx` | today's inline `HintsTab` |
| `tabs/SolutionsTab.tsx` | promotes `SolutionPanel` out from under the verdict |
| `tabs/DiscussionTab.tsx`, `tabs/HistoryTab.tsx` | thin wrappers over the existing `DiscussionPanel` / `HistoryPanel` |
| `CollapsibleSection.tsx` | new — Schema and Expected output |
| `EditorPane.tsx`, `ResultsPane.tsx`, `ActionBar.tsx` | `SqlPlayground.tsx` (451 lines) → three focused files |

### Pure modules

Extracted so they unit-test without a DOM, exactly as SP3 did with `lesson-nav.ts`:

- **`lib/workspace/problems-panel-model.ts`** — grouping by module, the "Not in a track" bucket, the Todo filter, tag regrouping, filter-text matching, `n/m` fractions. Everything that decides what the rows look like, with none of the rendering.
- **`lib/workspace/pass-rate.ts`** — formatting and the zero-attempt guard, so a problem nobody has attempted renders no chip rather than "0% pass".

### State ownership

`ProblemClient` remains the state owner — a CLAUDE.md convention — but sheds rendering to `WorkspaceLayout`. It keeps query, draft autosave, `useProblemDB`, dialect, history and solved state, and gains `problemsPanelOpen` and the collapsible state.

### The refactor constraint

`tests/e2e/sql-engine.spec.ts` asserts `data-testid="workspace-run-editor"` and `workspace-run-footer`, and the `dl:draft:`, `dl:dialect:` and `dl:query-timeout-ms` keys. **These testids and keys survive the split unchanged.**

More generally — this is the SP2 "capability lost in a deletion" shape — every file that is split or absorbed goes through an explicit inventory: what did it provide, and what provides that now. Specifically at risk, because none of them appear in the design screenshots:

- Run/Submit keyboard shortcuts (`⌘↵`, `⌘⇧↵`)
- the result-cap truncation warning
- the query-timeout recovery path that resets the engine
- `ReportDialog` and `AddToListButton` entry points
- the DuckDB-introspection schema fallback for when `lib/schema-parser.ts` returns `null`
- per-hint voting in `HintsTab`

---

## 3. Data layer

Two additive migrations. Nothing destructive.

### Migration A — pass rate counters

`attemptCount Int @default(0)` and `acceptedCount Int @default(0)` on `SQLProblem`, incremented inside the transaction that already writes the `Submission` row in `actions/submissions.ts`. That write path records **both** outcomes — `status: result.ok ? "ACCEPTED" : "WRONG_ANSWER"` — so the denominator is real and the migration backfills both columns from existing `Submission` rows.

Reads are O(1) per row for the whole panel — no aggregation, no cache, no invalidation. (The "412" in screen `09` is the mock's number, not a measured count of the live catalog.) No new index is needed for steady-state reads; the backfill is a one-time scan.

Two limits, surfaced in copy rather than hidden:

- `validateSubmission` refuses anonymous callers outright, so this measures **signed-in attempts only**.
- It counts submissions, not people — one learner's ten tries move it ten times.

Adding columns to `SQLProblem` triggers the CLAUDE.md `select`-projection rule: audit `actions/problems.ts`, `actions/profile.ts`, `actions/submissions.ts`, `actions/lists.ts` and the admin routes.

### Migration B — approaches on `DiscussionComment`

- `enum DiscussionCommentKind { COMMENT, APPROACH }`
- `kind DiscussionCommentKind @default(COMMENT)`
- `sql String? @db.Text`
- `strategy String?`

Approaches inherit `upvotes` / `downvotes` / `score`, `DiscussionVote`, `DiscussionReport`, the `VISIBLE / HIDDEN / DELETED / SPAM` statuses, `reportCount` / `hiddenBy`, and the existing admin moderation surface. Nothing gets a second pipeline.

**The one-approach-per-user rule cannot be a plain `@@unique([problemId, authorId, kind])`** — that would also cap comments at one per user per problem. It has to be a partial unique index, which Prisma cannot express in the schema, so it goes in the migration as raw SQL:

```sql
CREATE UNIQUE INDEX "DiscussionComment_one_approach_per_user"
  ON "DiscussionComment" ("problemId", "authorId")
  WHERE "kind" = 'APPROACH';
```

The server action catches the violation the way `addToList` catches `P2002`. Per the adapter note in CLAUDE.md, that catch reads `meta.driverAdapterError.cause.constraint.fields` and strips quotes — `meta.target` is always `undefined` under `@prisma/adapter-pg`.

### Moderation modes carry over

`ProblemDiscussionState.LOCKED` swaps the approach composer for the banner while approaches stay readable. `HIDDEN` hides both community surfaces — the Discussion tab and the community list inside Solutions — while the canonical `SolutionPanel` is unaffected, being editorial content rather than user content.

### New reads

- **`getWorkspaceProblemsPanel()`** — published catalog with `number / slug / title / difficulty / counters`, the user's solved set, and module grouping from `getTrackCurriculumForUser`. Wrapped in React `cache()` so the page's several consumers share one round trip. Today's `getProblems()` returns all published problems with no solved state and no pagination, so this is a new query rather than an extension.
- **Checkpoint context** — problem → `LessonCheckpoint` → `Article` → `Module` → `Track`, for the context bar, the "Comes from" card and the "Next checkpoint" target. Unambiguous in a way the reader's breadcrumb was not: `LessonCheckpoint` is `@@unique([problemId])`, so a problem belongs to at most one lesson and there is no lowest-position tiebreak.

### New writes

Post, edit, delete and vote on an approach. All resolve the session inside `actions/` and never take a caller-supplied `userId`, per the `lib/curriculum-write.ts` split rule — every export of a `"use server"` module is a client-callable RPC endpoint.

---

## 4. Tabs and results pane

### A name collision in the design, resolved

Screen `09` shows a `History` tab in the problem panel **and** a `History` tab in the results pane, and the README defines neither. They are specified here as different things:

- **Problem panel → History** — server-recorded submissions; today's `HistoryPanel`, expandable, with "load this code into editor" and "share approach".
- **Results pane → Runs** — this session's local runs: query, row count, elapsed. Client-only, never persisted. Fills a real gap, since `Run` results are currently lost the moment you run again.

### Description tab

Schema stays inline; there is no Schema tab. Mono `#247.` + title; chips for difficulty, Solved, tags, with pass rate right-aligned; body at 14px/1.7. Then two collapsibles — `SCHEMA` with per-table sub-collapsibles and a "Preview rows" toggle, and `EXPECTED OUTPUT` — then the "Comes from" card.

Both collapsibles are **open on first visit to a problem and collapsed thereafter**. A single `dl:seen:<slug>` flag decides, rather than per-section state.

### Hints tab

Gains the preamble stating that revealing a hint changes nothing about verdict, streak or progress. Progressive-reveal semantics preserved exactly — ordered, cumulative, "All hints revealed." when exhausted — as is the existing per-hint voting, which appears nowhere in the design.

### Solutions tab

`SolutionPanel` promoted out from under the verdict, gating untouched: reveal only after an accepted submission, only on a deliberate button, sign-in nudge for anonymous viewers, footer note kept verbatim. Header carries the `sparkles` mark in `accent-violet` and the dialect toggle.

Community approaches below, sorted by score, verified-first within equal scores, each row carrying author, strategy chip, SQL and vote column.

### Discussion tab

Today's `DiscussionPanel` restyled: Top/New sort; the composer's "Share my accepted query" shortcut now posts a real `APPROACH` instead of prefilling a textarea; one level of replies behind a `line` rule; the existing "Showing 2 of 5 replies." truncation; ghost Reply/Report actions; the LOCKED banner in place of the composer.

### Editor, results, action bar

A segmented DuckDB/Postgres control replaces today's single flip button; engine-ready dot; "draft saved"; `grid 40px 1fr` with the gutter. Results pane tabs (`Results / Verdict / Runs`) with a right-aligned `3 rows · 38 ms`.

Run (`⌘↵`) and Submit (`⌘⇧↵`) keep their shortcuts and the existing copy — *"Run executes locally · Submit records the attempt."* — with a primary-tinted "Next checkpoint" pushed right.

That button resolves to the next `LessonCheckpoint` in the same lesson by `position`. When the current problem is the **last** checkpoint of its lesson the button becomes "Back to lesson" pointing at the reader; when the problem has no `LessonCheckpoint` at all, no button renders and the action bar is just Run and Submit. Advancing to the *next lesson* is deliberately not offered here — that decision belongs to the reader, which already owns prev/next.

The accepted verdict renders as a primary-bordered row reporting the curriculum consequence — "+1 checkpoint · module 4 now 25%" — which requires recomputing that module's rollup after an accepted submission, and only when a `LessonCheckpoint` exists.

### Dependency

The Solutions tab's sparkles mark uses `--accent-violet`, whose **light value is unconfirmed** (handoff follow-up 5, nominally SP7's). SP5 needs it to ship screen `19`: either SP7 confirms it first, or SP5 does and SP7 inherits.

---

## 5. Testing

Written against the two failure shapes the handoff says have now repeated across SP2 and SP3.

| Suite | Covers |
|---|---|
| extend `test:console-nav` | `isAppRoute`, plus **mutual exclusivity** with `isFocusRoute` over a fixture of every real route |
| `test:problems-panel` | module grouping, "Not in a track" ordering, Todo filter, tag regrouping, filter matching, `n/m` fractions |
| `test:pass-rate` | formatting, zero-attempt guard, increment arithmetic |
| `test:approaches` *(DB)* | one-per-user partial-unique catch, LOCKED/HIDDEN gating, verified computation, and that `kind` filtering never leaks approaches into comment lists or the reverse |
| `tests/e2e/workspace.spec.ts` | exactly one `banner`, `main` present, **no footer**, panel toggle surviving reload, first-visit collapsible rule, both shortcuts |

**Every suite gets its line in `.github/workflows/test.yml` in the same PR that adds it.** Not a follow-up. This is the whole remedy for the gap that has now occurred twice.

### Two verification traps this design invites

Both are instances of the handoff's pattern 3 — "the check ran and was green" is not "the thing is correct".

- The counter backfill must be verified by **recomputing the aggregate and comparing values**, not by confirming the columns exist and are non-zero. A backfill that double-counts passes the weak check.
- "No footer on the workspace" must be asserted by querying for `contentinfo` and expecting nothing, not by eyeballing a screenshot where the footer is merely below the fold.

### Token audit

The design leans on `panel-raised`, `primary-row` and `line-strong`. Handoff follow-up 3 notes that `check:token-parity` cannot catch a token that exists but has no `@theme inline` utility — two dead classes already slipped through in SP3. Phase 1 audits every token the workspace uses against `@theme inline`; if that audit is expressible as a guard, it ships as one and closes follow-up 3.

---

## Phases

Four PRs against `main`, each independently mergeable.

1. **Shell** — `isAppRoute`, `ConsoleChrome`, predicate tests, token audit. Small and reversible.
2. **Layout** — component split, problems panel, context bar, collapsibles, tab restructure, Solutions promoted. No schema change. **The workspace redesign is complete and shippable at the end of this phase**, with the Solutions tab carrying only the canonical solution.
3. **Pass rate** — migration A, counters in the write path, backfill verification, chips.
4. **Approaches** — migration B, composer, community list, verified marks, moderation modes.

If phase 4 runs long or the user-generated-content surface needs its own thinking, phases 1–3 still leave the workspace fully redesigned and live.

## Open questions

Three things this spec decided on its own authority. Each is cheap to change before phase 2 and expensive after.

1. **Approach cardinality.** One per user per problem, editable and deletable. Assumed during design when the posting gate was widened to any signed-in user; not separately confirmed. Allowing several per user would drop the partial unique index and change the "my approach" UI state.
2. **`Runs` as the results-pane tab name.** Invented here to resolve the design's duplicate `History` tab. If it should instead mirror submissions, the panel tab is the one that changes, not this one.
3. **`--accent-violet` light value.** Unconfirmed upstream (handoff follow-up 5). Blocks screen `19` only.

## References

- Design bundle: `~/Downloads/design_handoff_learning_platform 2/` (local, uncommitted) — README section `4a` and `6a`; screenshots `09`, `10`, `19` (and `16` for the SP6 mobile view)
- Handoff: `docs/superpowers/handoff/2026-08-10-sp3-merged-sp4-sp5-sp7-next-handoff.md`
- SP3 spec `docs/superpowers/specs/2026-08-08-sp3-lesson-reader-design.md` — the focus-route contract this extends
- SP2 spec `docs/superpowers/specs/2026-08-06-console-shell-tokens-design.md` — the shell and token system
