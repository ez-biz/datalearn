# SP7 — Admin redesign

> Sub-project 7 of 7, the last of the learning-platform redesign. Design source: `~/Downloads/design_handoff_learning_platform 2/` README §Admin (`8a`), screenshots `20-admin-overview.png`, `21-admin-problems.png`, `22-admin-problem-form.png`, and `ConsoleAdminSidebar.dc.html`.

## Goal

Bring the admin surface onto the Console system: replace `AdminNav`'s horizontally scrolling row of 14 links with the grouped 236px sidebar, and rebuild the three screens the design specifies — Overview, Problems list, Problem form.

**Zero migrations.** Every data dependency in this spec resolves against schema that already exists, or the block is omitted.

## Scope

**In:** the admin shell (which re-skins all 23 admin pages at once), plus Overview, Problems list, Problem form.

**Out:** bespoke redesigns of the other 20 admin pages. They inherit the new shell and keep their current bodies. The design gives no direction for contests, moderators, API keys, schemas, tags, topics, tracks, articles, reports, discussions, contributors or daily; inventing layouts for them would mean reviewing invented work rather than commissioned work.

This mirrors SP2, which re-skinned 51 learner routes through the shell and token layer with no per-page component edits.

**Mobile:** desktop and tablet only. The design specifies a 236px sidebar and gives no small-screen direction. Admin is a desktop tool; a phone treatment is not in this sub-project.

## Decisions locked

| Decision | Choice |
|---|---|
| Scope | Shell + the 3 designed screens |
| Shell integration | One shell — `ConsoleChrome` selects an admin nav model; admin stays a **normal** route |
| Problem form layout | Five tabs, with validation errors surfaced on the tab strip; all fields stay mounted |
| Metric deltas | Only where honestly computable; no delta line at all elsewhere |
| Authoring-channels card | **Omitted** — no data source exists |
| Curriculum placement | Backed by the existing `LessonCheckpoint` relation; **no new columns** |

## The design's one schema proposal is already built

The design proposes adding nullable `lessonId` + `checkpointOrder` to `SQLProblem`, on the grounds that the learner side "has nothing to resolve against" without it.

That is no longer true. SP1 shipped `LessonCheckpoint` after the design was written, and it carries exactly that data:

```prisma
model LessonCheckpoint {
  articleId String
  problemId String
  /// 0-indexed. Mutable ONLY inside reorderCheckpoints' transaction.
  position  Int
  @@id([articleId, problemId])
  @@unique([problemId])
  @@unique([articleId, position])
}
```

`@@unique([problemId])` already makes the binding 1:1, and `@@unique([articleId, position])` already sequences it. The learner side resolves against it today — `lib/curriculum-read.ts` reads checkpoints, and `ActionBar` carries `checkpointContext`.

Adding the proposed columns would create **a second source of truth for a fact the database already stores**. That is this project's most repeated bug class — the same value computed or stored two ways, which has produced four separate defects across this redesign. It would also put a `position` on an ordinary mutable column, breaking the rule that positions move only inside their reorder transactions.

**Ruling: build the Curriculum-placement panel the design asks for, backed by the existing relation.** The UI is right; the schema note is stale.

## Architecture

### The shell

**Correction to an earlier reading of the current state.** Admin does not opt out of the console shell. `ConsoleShell` wraps every route from the root layout (`app/layout.tsx:87`), and `/admin/*` matches neither `isFocusRoute` nor `isAppRoute`, so admin is already a **normal** shell route. `app/admin/layout.tsx` then adds `AdminNav` *inside* that shell.

So an admin on `/admin/problems` currently sees **two navigations stacked**: the learner sidebar (Home / Practice / Learn …) plus the horizontal admin row. That redundancy — not a missing shell — is what this phase fixes.

The work is therefore a **swap, not an addition**: `ConsoleChrome` keeps sole ownership of `#app-scroll`, `<main id="main-content">` and `<Footer>`, and gains one branch — for `/admin` paths it renders the admin nav model instead of the learner one, and marks that subtree so the violet accent applies. `AdminNav` is then deleted and `app/admin/layout.tsx` keeps only its auth check and badge-count queries, which move to feeding the sidebar.

Admin remains a **normal** shell route. There is no fourth shell mode, so `isFocusRoute` and `isAppRoute` stay provably disjoint and their mutual-exclusivity unit test is untouched. Sidebar collapse, the collapse cookie, scroll restoration and the skip link are all inherited rather than reimplemented.

### The nav model

`lib/admin/admin-nav-model.ts` — pure data and pure functions, no Prisma, no React. Unit-testable without a DOM, following `nav-model.ts`, `catalog-model.ts` and `lesson-nav.ts`.

Groups, matching the design:

- (ungrouped) Overview
- **Content** — Problems, Schemas, Topics, Tracks, Articles, Tags
- **Scheduling** — Daily, Contests
- **Moderation** — Reports, Discussions
- **People & access** — Moderators, Contributors, API keys

Header: a violet `shield-check` mark, "Admin", and a role chip (Owner / Moderator). Footer: "Back to the site". Badge counts (`articleQueue`, `openReports`, `discussionQueue`) render as violet pills.

### Role filtering

To be precise about what is and is not true today: `AdminNav` is a client component, but its `role` and `canViewDiscussionQueue` inputs are resolved **server-side** in the layout and passed as props, and the filter runs before render — so a moderator's rendered HTML already contains no admin-only links. The current behaviour is correct; the item list merely also ships in the client bundle, which exposes route names, not data.

Moving the nav model to a server component keeps that guarantee and stops shipping the list. The requirement for the rebuild is therefore: **the filter must stay server-side, and a moderator must never receive admin-only items in rendered HTML.** This is a property to preserve, not a hole to close.

The existing three-layer gating is unchanged — middleware (`middleware.ts:66-123`), the admin layout (`app/admin/layout.tsx:17-22`), and per-route `withAdmin` / `requireAdminPage`. This spec changes only what is rendered, never what is authorized.

Note the existing asymmetry, which the sidebar must reflect: the layout admits ADMIN **or** MODERATOR, and middleware then narrows moderators to discussion paths. A moderator who sees links that 403 is a bug.

### Tokens

`--accent-violet` already exists in both themes — dark `#A78BFA` (`app/globals.css:55`), light `#6D28D9` (`:160`, still commented "SP7 to confirm"), with `--accent` aliased to it in both. `check:token-parity` already passes.

SP7 does not add tokens. It uses them, and confirms the light value in situ — closing a follow-up carried since SP4.

## Screens

### Overview

A breadcrumb bar carries the four quick actions — New problem `⌥P`, article `⌥A`, track `⌥T`, contest `⌥C` — as bordered buttons with `Kbd` chips, moved out of the page body so they are reachable from every admin screen.

**Every `Kbd` chip must be wired to a working listener.** This project has twice shipped a keyboard hint with no handler behind it: the `/` shortcut surfaced in SP4, and the hero's `↵` in SP6. A chip that does nothing is worse than no chip.

**Metrics.** Today `getAdminDashboardMetrics` returns seven. The design moves two of them — open reports, pending review — into the queue stack, leaving five. **Render the five that are real; do not invent a sixth to fill the grid.**

**Deltas.** The design gives every card a delta line. Only some can produce one honestly, because no model carries `publishedAt` and `updatedAt` moves on any edit:

| Metric | Delta | Why |
|---|---|---|
| Problems | ✅ | `createdAt`, this period vs previous |
| Contests | ✅ | `createdAt` |
| Submissions (7d) | ✅ | this 7d vs prior 7d |
| Articles (published) | ❌ | status transitions are not historized |
| Tracks (published) | ❌ | status transitions are not historized |
| Open reports | ❌ | queue depth — growth has no meaning |
| Pending review | ❌ | queue depth |

Where a delta is not honest, render **no delta line at all** — not a grey zero, not a dash.

**Queue stack.** Open reports, articles awaiting review and flagged comments become full cards, each tinted with its own semantic colour and carrying a verb (Triage / Review / Moderate). Each must have an honest empty state — an empty queue is good news and should read as such, not as a broken card.

**Recent activity** keeps its current shape.

**Authoring channels: omitted.** `AdminAuditLog` records `actorId`, `action`, `targetType`, `targetId`, `metadata` and `createdAt` — no channel. `recordAdminAction` takes no channel argument. The principal type is known at write time (`requireAdmin` distinguishes Bearer from session) but is never persisted, so the breakdown cannot be computed. Recording it is a reasonable follow-up; fabricating it is not.

### Problems list

Header keeps the `/api/admin/problems` note and the New-problem button. Table columns and grid match the current implementation exactly: `#`, title + slug, status pill, difficulty, schema, tags, submissions, row actions.

Status pills keep their four existing states (draft / beta / published / archived), recoloured to the Console palette.

Added: a search field and a status segmented filter. Filtering is **client-side over the already-loaded set**, with local state that is not URL-synced — matching SP4's catalog.

**What this does not fix:** the page loads every problem with no pagination (`app/admin/problems/page.tsx:20`, a bare `findMany`). Search makes the list usable, not cheap. Production held 67 problems when last counted (2026-06-14; production credentials are Vercel-only, so this is not freshly verified) and the design's "412 rows" is mock data — so an unpaginated load is fine at today's scale. Pagination is a follow-up, not smuggled into this sub-project. **If that count has grown substantially, revisit this decision before building the list.**

### Problem form

Two panes.

**Left — Basics:** title; slug, mono, with its "Lowercase, hyphenated" helper; difficulty and status as segmented controls rather than selects; SQL engines as toggle chips; description textarea; the Ordered-comparison checkbox with its existing helper text. Then the hints editor with reorder and delete.

**Right — the authoring loop:** solution SQL with a dialect toggle, the Run & capture button, and captured expected output stored as JSON — exactly as `ProblemForm` works today. Per-dialect `solutions` and `expectedOutputs` remain maps keyed by `Dialect`.

Below it, a **validation checklist** surfacing what is currently implicit: the solution runs clean on both engines, expected output is captured and non-empty, and a warning when the problem has no tags and so will appear under no topic.

**Curriculum placement** — a violet-tinted panel binding the problem to the lesson it checks, plus its checkpoint order.

- Backed by `LessonCheckpoint`. No new columns.
- Every write goes through `addCheckpoint` / `removeCheckpoint` / `reorderCheckpoints` in `lib/admin-curriculum.ts`. `position` is never written directly.
- Because of `@@unique([problemId])`, **a problem can be the checkpoint of exactly one lesson.** The panel must say so, and moving a problem means reassigning it, not adding a second binding.
- With no curriculum present the panel must degrade honestly — production currently has zero modules and zero lessons.

**Tabs** — Basics / Schema / Solution & expected / Hints / Curriculum — replace the current single long scroll.

- **All fields stay mounted.** Switching tabs changes visibility, never mounting. Losing half an authored problem to a tab switch is the failure this rule exists to prevent, and it is the same rule SP6's mobile panes needed.
- **Errors surface on the tab strip.** Any tab holding an invalid or incomplete field is marked, and a failed save switches to the first tab with a problem. An invisible validation error on the most-used authoring screen is not acceptable.

## Testing

Following the pattern every sub-project has used: pure logic in `lib/` gets unit suites that need no database and no DOM; screens get Playwright.

- **`lib/admin/admin-nav-model.ts`** — groups, ordering, badge placement, and **role filtering**, including the moderator case. Pure.
- **Delta computation** — pure function over counts and dates: growth, regression, neutral, and the cases where no delta is returned at all. Pinned dates, never `Date.now()`.
- **Problems-list filtering** — pure: search matching, status filter, and their combination.
- **Playwright** — the admin shell renders the grouped sidebar; a moderator does not receive admin-only nav items; the problem form preserves field values across tab switches; a validation error marks its tab.

Every new suite is wired into `.github/workflows/test.yml` **in the same PR that adds it**.

**CI seeds no curriculum data**, so any test touching tracks, modules or lessons creates its own fixture and cleans up. Tests must not mutate ambient rows: if an assertion requires the absence of ambient data, detect and skip locally but **fail rather than skip when `CI` is set**.

## Inherited constraints

- `ConsoleChrome` owns `#app-scroll`, `<main id="main-content">` and `<Footer>`. No competing scroll container; no `<header>` inside `<main>` — ARIA forbids `banner` there.
- Exactly three shell modes; `isFocusRoute` and `isAppRoute` provably disjoint.
- Semantic colour tokens only. No hex, no `slate-*` / `blue-*`.
- No emoji icons — Lucide SVG only.
- No `lib/` file imports from `actions/`.
- No `"use server"` module exports a function taking a caller-supplied `userId`.
- Positions move only inside their dedicated reorder transactions.
- `lib/admin-validation.ts` stays Prisma-free — the MCP server bundles it.
- **The fallback rule:** a block that would render empty must show an honest alternative or not render.
- `next build` must keep `--webpack`.

## Deliberately omitted

| Item | Why |
|---|---|
| `lessonId` / `checkpointOrder` on `SQLProblem` | `LessonCheckpoint` already stores it; adding them creates a second source of truth |
| Authoring-channels card | No channel is recorded anywhere |
| Deltas on 4 of 7 metrics | Status transitions are not historized; queue depth has no growth direction |
| A sixth metric card | Only five real metrics remain after the queues move out |
| Redesigns of the other 20 admin pages | Not specified by the design |
| Problems-list pagination | Not designed; not a problem at current scale |
| Admin on phones | No small-screen direction in the design |

## Follow-ups this creates

1. Record an authoring channel on `AdminAuditLog` and build the channels card.
2. Paginate the problems list before it outgrows a single load.
3. Confirm the light `--accent-violet` value in situ and drop its "SP7 to confirm" comment.
