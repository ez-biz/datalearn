# SP6 — Home and mobile workspace

> Design spec. Status: agreed 2026-08-14. Implementation plan to follow.
>
> Sub-project 6 of 7 in the learning-platform redesign. Depends on SP4 and SP5, both merged and released in v0.9.0. The last learner-facing sub-project; only SP7 (admin) remains after it.

## What this is

Three screens: **home signed-out**, **home signed-in**, and the **mobile workspace** that SP5 deferred here with a code comment (`components/practice/workspace/WorkspaceLayout.tsx:25-26`).

The mobile learn hub (screenshot `14`) and mobile lesson reader (`15`) are **not** in SP6. They are documents that already stack and scroll acceptably on a phone; redesigning them would be cosmetic, and it would make SP6 five screens — larger than any sub-project so far.

Design source: README sections 1, 2 and 9; screenshots `01`, `02`, `16`.

## Decisions locked

Made during brainstorming on 2026-08-14. Don't relitigate without new information.

| Decision | Choice |
|---|---|
| Curriculum gap | **Degrade gracefully and build now** — every curriculum block has an honest fallback |
| Mobile scope | **Workspace only.** Learn hub and lesson reader stay as they are |
| Hero CTA | **"Start the path" → first published track.** The assessment is omitted |
| Weak spots | **Build as designed** — per-tag pass rate over recent submissions |
| Segment switching | **All three panes mounted, visibility toggled by CSS** |

**Zero migrations across SP6.**

---

## 1. The fallback rule

This is the spine of the sub-project. The design assumes a populated curriculum. Production does not have one:

| | production | local |
|---|---|---|
| published problems | 39 | 23 |
| lessons (`ModuleLesson`) | **0** | 17 |
| published tracks | 3 | 1 |
| modules | **0** | 5 |

SP4 shipped a tracks index that read only the curriculum model and rendered "0 lessons · 0 problems / No lessons yet" for every published track on production. It took two PRs to find and fix. SP6 applies that lesson **before** shipping.

Every curriculum-dependent block degrades:

| Block | With curriculum | Without |
|---|---|---|
| Signed-out path preview | six module rows | published tracks with problem counts |
| Signed-in resume card | "Module 4 · Lesson 2 · read 62%" | next unsolved problem |
| Signed-in module progress | six module cards | **omitted entirely** — not six empty cards |
| Hero stat strip | `N problems · N lessons · N tracks` | drops any clause that would read zero |

The rule: **a block that would render zero or empty either shows its honest alternative or does not render.**

### Omitted outright

- **"Take the 12-min assessment"** — the hero's primary CTA in the design. No route, action, model or reference exists anywhere in the repo. The primary becomes **"Start the path"** → the first published track, with "Browse problems" → `/practice` as the secondary the design already specifies.
- **"Assessment decides where you enter"** — the path-preview card's footer, for the same reason.

### Built, though nothing implements it today

**Weak spots.** The design specifies per-tag pass rate over recent submissions. `getProfileData` returns a `skills[]` array, but that is per-tag *solved counts* — "what have you done most of", not "what are you worst at". SP1's spec anticipated the real thing: *"pure `Submission` + `Tag` queries needed only by the dashboard"*. Every input exists; no schema change.

---

## 2. Home — signed out

Structure follows the design: hero on `1fr 470px`, "How it works" as four cards with a 2px `primary` top border, and Proof as two columns — `check`-prefixed claims on the left, a real accepted submission on the right with its `#247 · second-highest-salary.sql` / `Accepted · 38 ms` header and verdict footer.

**That submission is static illustrative markup**, not a live query. It is marketing copy showing what the product does.

**The path preview is the only block with logic** — module rows when a track has modules, published tracks with their problem counts when it does not.

**The existing `<Footer>` stays.** `ConsoleChrome` owns it for every route; the design's four-column footer is a shell-wide change and belongs to SP2's surface, not to one page.

---

## 3. Home — signed in

Replaces `components/home/UserHome.tsx` (502 lines), split the way SP4 and SP5 split their oversized files. Two columns `1fr 340px`.

| Block | Source |
|---|---|
| Date h1 + track percentage | `getTrackSummariesForUser` rollup |
| Resume card | curriculum resume → next unsolved problem |
| Today's plan | composed; see below |
| Module progress | curriculum rollups; omitted without modules |
| Recent submissions | `getUserStats().recent` with verdict chips |
| Streak week grid | `computeStreaks` (`lib/profile-stats.ts`) + the heatmap's last 7 days |
| Daily problem | `getDailyStatusForCurrentUser()` |
| Weak spots | new pure computation |

### "Today's plan" — a definition the design does not give

Up to three rows, in priority order:

1. resume the in-progress lesson;
2. the daily problem, if unsolved today;
3. the next unsolved problem.

Each row is a state icon, title, mono meta and "Open →". A learner with no curriculum gets rows 2 and 3, so it degrades to something useful rather than vanishing.

### A narrower read

`getProfileData` already returns everything the rail needs, but computes a **365-day heatmap** and the full skills breakdown to feed a card showing 7 days. SP6 adds `lib/home/home-read.ts` scoped to what home actually renders, rather than paying that cost on every visit. Same reasoning as `getTrackSummariesForUser` being bounded.

Not a `"use server"` module — it takes an explicit `userId`, per the rule in CLAUDE.md.

---

## 4. Mobile workspace

Below `lg`, the panes collapse to a **Problem / Code / Result** segmented control (36px segments).

### All three panes stay mounted

Visibility is toggled by CSS. Monaco mounts **once**, so the query text, undo history, cursor and scroll survive switching to Problem and back, and the DuckDB connection in `ProblemClient` is untouched.

Conditional mounting would unmount Monaco every time a learner checks the problem statement — re-running its initialisation and discarding undo history. The hidden DOM is cheap by comparison.

### The verdict signal

The design says the Result segment turns `primary` when a verdict is waiting: it **signals rather than switching**, so submitting does not yank the learner off the editor.

`ProblemClient` already receives the outcome — its `handleSubmit` gets the result and pushes it to history — so it owns both `activeSegment` and an `unseenVerdict` flag that clears when Result is opened. Nothing has to be lifted out of `EditorPane`.

### The SQL accessory row

`SELECT FROM WHERE OVER PARTITION BY ORDER BY ( ) , *` as 36px mono chips, horizontally scrollable, inserting at the cursor.

`SqlEditor` already captures the editor instance in `handleMount`; SP6 adds an `onEditorReady` callback so the row can call `executeEdits` at the current selection.

Mobile web cannot reliably detect the keyboard, so the design's "above the keyboard" becomes **pinned below the editor**, sticky at the bottom of the Code segment above the action bar.

### One shell change

SP5 clamped `#app-scroll` only at `lg` and up, because below that the workspace stacked and scrolled with the page. A segmented workspace is an application view at **every** width, so the clamp extends to all widths on app routes, keeping the `pb-14` that clears the fixed `MobileTabBar`.

One line in `ConsoleChrome` — and `tests/e2e/workspace-shell.spec.ts` must be updated, since it currently asserts `overflow-y: auto` below `lg`.

### The problems sheet

Screenshot `16` has a list icon in the header. Without it there is no way to reach another problem on a phone — `ProblemsPanel` is `lg:flex` only. It opens the panel as a full-screen sheet, **reusing `ProblemsPanel`** rather than a mobile copy.

Run and Submit become equal-width 46px buttons below `lg`; the action bar above `lg` is unchanged.

---

## 5. Testing

Three new pure modules, each with a suite wired into `.github/workflows/test.yml` **in the PR that adds it**.

| Suite | Covers |
|---|---|
| `test:weak-spots` | per-tag pass rate, weakest-first ordering, band thresholds, and zero submissions rendering nothing rather than 0% |
| `test:today-plan` | row composition and priority, **and every degraded path** — no curriculum, no daily, nothing unsolved |
| extend `test:console-nav` | none needed; no predicate changes |

`lib/home/home-read.ts` is Prisma-touching and is covered by e2e, matching how `curriculum-read.ts` and `tracks-read.ts` are treated.

### The two assertions to write first

1. **Compose the plan and the path preview with zero modules and zero lessons, and assert the degraded output.** Production is exactly that shape. The tracks index shipped broken because nothing tested it.
2. **At 375px, type into the editor, switch to Problem, switch back, assert the text survives.** This is what catches a later "simplification" of the CSS toggle into conditional mounting.

### Capability inventory

Behaviours in the files being replaced that appear in no design screen:

| Capability | Lives in |
|---|---|
| New-user hero for a learner with no submissions | `components/home/UserHome.tsx` |
| Progress-by-difficulty breakdown | `UserHome.tsx` |
| "Recommended next" first-unsolved card | `UserHome.tsx` |
| Featured problems + topics on the anonymous page | `app/page.tsx` (321 lines) |
| **`tests/e2e/daily.spec.ts` asserts the Daily problem card on `/`** | existing e2e — must keep passing |
| `MobileTabBar` / `MobileSignInMenu` | must survive the clamp change |

---

## Phases

Four PRs against `main`, each independently mergeable, **zero migrations**.

1. **Pure logic + read** — weak spots, today's plan, `home-read`. No UI. This is where the degraded-path tests live.
2. **Signed-in home** — replaces `UserHome.tsx`.
3. **Signed-out home** — hero, path preview, how-it-works, proof.
4. **Mobile workspace** — segments, accessory row, problems sheet, and the `ConsoleChrome` clamp with its e2e update.

Phase 4 is the only one touching already-shipped working code, so it goes **last** — the reverse of SP4, where the shared read had to come first.

## Open questions

Two things this spec decided on its own authority.

1. **"Today's plan" is defined here, not in the design.** Three rows in priority order. If it should be something else — a fixed daily set, or driven by weak spots — that changes phase 2.
2. **The mobile learn hub and lesson reader are out of scope.** They stay as they are, so SP6 does not "finish mobile"; it finishes the mobile *workspace*.

## References

- Design bundle `~/Downloads/design_handoff_learning_platform 2/` (local, uncommitted) — README sections 1, 2, 9; screenshots `01`, `02`, `16`
- SP4 spec `docs/superpowers/specs/2026-08-13-sp4-index-screens-design.md` — the fallback pattern this generalises
- SP5 spec `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md` — the deferral this closes
- Handoff `docs/superpowers/handoff/2026-08-13-sp4-complete-handoff.md` — environment traps and the release ordering
