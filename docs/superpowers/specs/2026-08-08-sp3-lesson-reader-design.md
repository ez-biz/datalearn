# SP3 — Lesson reader

**Status:** design approved, not yet implemented
**Date:** 2026-08-08
**Sub-project:** SP3 of the 7-part learning-platform redesign (see [`2026-08-01-curriculum-spine-design.md`](./2026-08-01-curriculum-spine-design.md) for the decomposition)
**Depends on:** SP1 (curriculum spine, merged) + SP2 (tokens + shell, merged)
**Blocks:** SP6 (home + mobile), together with SP4 and SP5

---

## What this is

SP3 is the first visibly-new screen of the redesign, and the only one that renders SP1's 17 authored lessons — content **no one has seen in any environment**. SP1 shipped the data and no UI; SP2 re-skinned 51 existing routes and shipped no new screen. SP3 is where the two finally meet.

### Source of truth

The design handoff at `~/Downloads/design_handoff_learning_platform 2/`:

- `README.md` — "6. Lesson reader (`1b`)", plus the "Interactions & behaviour", "State" and "Light theme" tables
- `screenshots/05-lesson-reader.png` — the three-rail desktop reader (dark)
- `screenshots/18-light-lesson-reader.png` — the same, light
- `screenshots/15-mobile-lesson.png` — the mobile treatment

Explicitly **not** SP3: the Module screen (`06`), the Learn hub (`03`), and the Tracks index (`07`) — all SP4.

---

## Decisions

Locked during brainstorming. Do not relitigate without a reason that did not exist on 2026-08-08.

### 1. A new curriculum route; the article body becomes shared

The reader is `app/learn/tracks/[slug]/[lessonSlug]/page.tsx`. The existing topic route `app/learn/[topicSlug]/[articleSlug]/page.tsx` keeps its single-column layout.

The body, TOC extraction and markdown rendering are extracted into shared components that both routes consume. The same article is therefore reachable at two URLs; the topic URL is canonical and the reader emits `rel="canonical"` pointing at it.

*Rejected:* a `?track=` query param on the existing route (track context living in a param is fragile — one internal link that drops it silently downgrades the screen), and making the single reader always curriculum-aware (40+ topic articles would inherit chrome they have no data for).

### 2. The module is not in the URL

`Module.slug`'s schema comment already commits to deriving the `04-` display prefix from `position` at render time "so reordering never breaks a URL". The breadcrumb shows `track / 04-window-functions / lesson`; the path is `/learn/tracks/<track>/<lesson>`.

`ModuleLesson`'s `@@id([moduleId, articleId])` permits one article in two modules of the same track. **Resolution rule: lowest module `position` wins.** This is deterministic, and reordering cannot change which module a URL resolves through except by actually changing the intended order.

### 3. SP3 carries a minimal spine so the reader is reachable

`/learn/tracks/[slug]` currently renders `TrackItemRow` over `TrackItem` and is blind to SP1's `Module` / `ModuleLesson`. Locally that table has **0 rows**, so the page has nothing to show and nothing links to a lesson.

SP3 adds a module-grouped lesson list to that page — functional, deliberately not to the SP4 Module design. SP4 replaces it.

*Rejected:* reader-only. SP2's review established that capability with no reachable path is where defects hide; a screen that merges unreachable cannot be reviewed in situ.

### 4. DRAFT tracks render for admins only

`getTrackCurriculumForUser` filters `status: "PUBLISHED"`, and the seeded track is `DRAFT` on purpose. Today the reader would render nothing.

It gains a third parameter:

```ts
getTrackCurriculumForUser(trackSlug, userId, { allowDraft }: { allowDraft: boolean })
```

`allowDraft` is resolved in `actions/curriculum.ts` from the session, and is true for `UserRole.ADMIN` **or** `UserRole.MODERATOR` — matching the gate `app/admin/layout.tsx` already applies, so draft preview and the admin portal agree on who is staff. Such a viewer sees a persistent "Draft — not visible to learners" banner. Everyone else gets `notFound()`, exactly as today.

`getTrackCurriculumForUser` stays a plain `lib/` function taking an explicit `userId` and **must not** gain a `"use server"` directive — the rule `lib/curriculum-write.ts` exists to enforce. Publishing the track remains a deliberate human action, not a side effect of a UI PR.

### 5. Progress is a scrollable-distance ratio, written on 10% boundaries

Measured on `#app-scroll`, rAF-throttled:

```text
denom = scrollHeight - clientHeight
pct   = denom <= 0 ? 100 : round(scrolled / denom * 100)
max   = Math.max(max, pct)
```

`max` is monotonic, mirroring `LessonProgress.percent`'s documented contract exactly.

The `denom <= 0 → 100` branch is load-bearing, and more so than it first appears: **every one of the 17 seeded lessons is 4 or 5 minutes** (12 × 4min, 5 × 5min — there is no long lesson in the corpus). On a tall desktop window a 4-minute lesson can produce no scrollable distance at all. Without this branch, a large fraction of the track would be permanently uncompletable, and the failure would be silent.

Writes fire when `floor(max / 10)` increases, plus a flush on `visibilitychange → hidden` — ~10 writes per lesson worst case. Signed-out readers run identical math and never call the action; `recordLessonProgress` already no-ops without a session.

*Rejected:* a bottom-of-content IntersectionObserver sentinel (persists no partial progress, so the "Read 62% · 3 min left" card has no data), and time-on-page gating (anti-gaming the design never asked for, on a free practice site).

### 6. SP3 is responsive at all three widths

The mobile reader is specified inside the reader section of the handoff, not in SP6's. Shipping the flagship screen desktop-only would leave it unfinished on phones — the same "capability with no replacement" shape SP2's review caught twice.

### 7. Style the blocks the corpus actually uses

Verified against all 17 lessons in the local database:

| Feature in the corpus | Count across 17 lessons |
|---|---|
| Leading `# H1` identical to `article.title` | **17 / 17** |
| `summary` present (→ standfirst) | 17 / 17 |
| `##` headings (→ TOC) | 3–6 each |
| ` ```sql ` blocks | 1–5 each |
| `:::callout` | 1 each |
| **Markdown tables** | **0** |
| **`:::side-by-side`, `:::steps`** | **0** |

SP3 styles h1 / standfirst / meta line / body / h2 / inline code / fenced SQL / callout. Comparison-table styling ships as **CSS only** — free, and applies the moment anyone writes a table.

The design's **query + result pair is dropped from SP3**. It is mock content: no lesson contains one, and making it real requires authored result rows that exist in no field. Building the directive is the small part; writing 17 lessons' worth of result tables is the large part, and it is content work, not UI work.

*Rejected:* backfilling all 17 lessons (scope belongs to a content pass), and authoring one showcase lesson (puts a single lesson on a code path the other sixteen never exercise).

### 8. PR #168 is absorbed, then closed

Open since 2026-06-16, touching `TableOfContents.tsx`, `MarkdownRenderer.tsx`, `globals.css` and the article page — the exact files SP3 rewrites, and its `globals.css` hunk predates SP2's palette.

Carried forward into this spec: body line-height ~1.75, the softer 450 body weight, a softened body colour (now `--text-2`), a scrollable long TOC, and `tabular-nums` on the reading percentage. Dropped: its `globals.css` hunk, which is against the old palette.

Close #168 with a comment pointing here.

---

## Architecture

### Shell opt-out

**The reader is a focus mode.** Screenshot `05` shows no console sidebar: the 270px curriculum rail *replaces* SP2's `ConsoleSidebar`, under a 48px bar carrying only the logo mark, breadcrumb, `n / m` counter and Prev/Next.

`ConsoleShell` is mounted in the root layout at `app/layout.tsx:83`, wrapping `#app-scroll`, `<main>` and `<Footer>`. A nested layout cannot remove it.

A single pure predicate `isFocusRoute(pathname)` is consumed by `ConsoleChrome` (already a client component) and by `Footer`, suppressing the sidebar, rail, mobile tab bar and footer on reader routes.

*Rejected:* moving all 51 routes into an `app/(console)/` group to get a sibling `(focus)` group — a large, risky diff for one screen.

`isFocusRoute` gets unit tests including the near-misses: `/learn/tracks/x` must **not** be a focus route, only `/learn/tracks/x/y`. SP2's `aria-current` double-marking bug came from exactly this class of untested nav predicate.

### Scroll model

**The reader does not introduce a second scroll container.** `#app-scroll` stays the single scroller, as SP2 established.

The reader is a three-column grid inside `<main>`. Both rails are `sticky top-12` with their own `overflow-y-auto`; the reading column flows in the page scroll. This preserves `MainScrollRestoration` untouched, keeps the progress model measuring one well-defined element, and still delivers the independently-scrolling rails the design shows.

### Data flow

One server fetch per page: `getTrackCurriculum(trackSlug)` and `getArticle(lessonSlug)`, both `cache()`-wrapped for the `generateMetadata` dedup this codebase uses everywhere.

**No new Prisma models. No migration.** `TrackCurriculum` already carries everything the rails need — module `rollup` and `unlocked`, lesson `completed` and `readingMinutes`, checkpoint `solved` / `difficulty` / `number`.

The flat lesson index (`14 / 37`), prev/next neighbours and breadcrumb are derived by a **pure function over the curriculum**, unit-testable with no database.

`unlocked` remains advisory. It may drive copy and nothing else — it must never gate this route, per the standing rule in `CLAUDE.md`.

### Components

```text
app/learn/tracks/[slug]/[lessonSlug]/page.tsx    server, sole fetcher

components/learn/reader/
  LessonHeader.tsx        48px bar: logo, breadcrumb, n/m, Prev/Next
  ReadingProgressBar.tsx  client; owns the scroll listener and the writes
  CurriculumRail.tsx      270px; modules, lessons, state icons
  LessonBody.tsx          SHARED with the topic route
  CheckpointBlock.tsx     from LessonCheckpoint data, not from markdown
  LessonPrevNext.tsx      the paired cards
  LessonAsideRail.tsx     250px; Contents, Lesson state, sign-in nudge
  ContentsSheet.tsx       mobile bottom sheet
  lesson-nav.ts           pure: flatten, index, neighbours, breadcrumb
```

`LessonBody` is what the topic route also adopts, and it is where the **duplicate-`<h1>` fix** lands: the leading `# Title` is stripped from content before rendering, because it is byte-identical to `article.title` in all 17 lessons. Today the topic route renders both — a duplicate top-level heading on every article.

---

## Visual spec

All tokens verified present in `app/globals.css` except one addition.

| Element | Token |
|---|---|
| Rails | `--panel`, `--line` |
| Reading column | `--panel-raised`; body `--text-2` at 15.5px/1.72 |
| h1 | 34px / 600 / -0.025em |
| Standfirst | 16px / 1.55, `--text-muted` |
| h2 | 20px / 600, `--line-faint` underline |
| Current lesson row | `--primary` left border + `--primary-row` background |
| Todo icon | `--icon-off` (already exactly `#3A3A42`) |
| Done icon | **new `--icon-done`** |
| Current icon | `--primary` |
| Callout | `--warning-bg` / `--warning-border`, lightbulb, bolded lead-in |
| Inline code | `--code-bg` / `--code-text` |
| Checkpoint block | `--primary-border` on `--primary-bg` |

### The one new token

The design gives the done-state icon as `#4A8F7B` in dark. **The light-theme table has no counterpart for it** — the design's light table simply omits the role.

```css
:root  { --icon-done: 163 32% 43%; }  /* #4A8F7B — from the handoff */
.light { --icon-done: 160 33% 37%; }  /* #3F7D68 — PROPOSED, unconfirmed */
```

The intent the value has to preserve is the three-way distinction the rail depends on: current is vivid (`--primary`), done is a *muted* green that recedes once earned, todo is inert (`--icon-off`). A light done-state cannot simply reuse `--primary`, or done and current become indistinguishable.

`#3F7D68` keeps the dark value's hue and saturation and darkens it for contrast on white — the same move the handoff makes for `primary` (`#4ADE9E` → `#0E9F6E`). It is **flagged unconfirmed exactly as `--accent-violet` is**, and a design pass should confirm or replace it.

Adding it to `:root` alone fails `npm run check:token-parity`, by design.

### Elements dropped for having no data source

Three things in screenshot `05` are backed by nothing in the schema. They are omitted, not invented:

| Design element | Why |
|---|---|
| "ASKED AT" company chips | No company field or model anywhere in `schema.prisma` |
| `64% pass` on checkpoint rows | Not stored. `Submission` has no `[problemId, status]` index, so a global rate is an unindexed scan — and there are 2 submission rows total, so the figure would be noise |
| `INTERVIEW-CRITICAL` chip | No such field |

Tag chips **do** render — but from real data, which is one broad tag per lesson (`sql foundations`, `window functions`), not the mock's three.

Each is recorded as a data-model follow-up below.

---

## Responsive

| Width | Layout |
|---|---|
| ≥1280 | three columns, 270 / 1fr / 250 |
| 1024–1280 | curriculum rail → drawer; right rail hidden; Contents folds into the drawer |
| <1024 | single column; sticky footer pairs **Contents** with **Next lesson**; Contents opens as a bottom sheet |

Below 1024 the sticky footer sits at the true viewport bottom, because `isFocusRoute` suppresses SP2's 56px `MobileTabBar`. That interaction gets an explicit test — it is precisely the "what did the removed thing provide" trap SP2's review caught twice.

Mobile type per screenshot `15`: h1 27px/600, body 16px/1.7, code blocks scroll horizontally rather than wrap, checkpoint rows ≥44px.

---

## Behaviour and edge cases

Resolved here because the design does not cover them.

| Case | Behaviour |
|---|---|
| Lesson with no checkpoint (**4 of 17**) | Block omitted entirely. No empty card. |
| First / last lesson | A single prev-or-next card, not a disabled pair |
| Signed out | Full progress bar; nothing persists; dashed sign-in card — *"Reading is free. Sign in to keep the checkmarks and the streak."* |
| DRAFT track, admin | Renders, with a persistent draft banner |
| DRAFT track, non-admin | `notFound()` |
| Lesson not in the track | `notFound()` |
| Article in two modules of one track | Lowest module `position` wins |
| `prefers-reduced-motion` | The 300ms progress-bar width transition is disabled |
| Print | Rails `display:none`; SP2's print stylesheet already anticipates this |

Auto-completion is on the bar reaching 100%, never a button — per the handoff's interaction table.

---

## Testing

Following SP2's pattern, because its real defects were all found in pure predicates.

**Unit** (`node:test`, matching `scripts/test-console-nav.ts`):

- `lesson-nav.ts` — flatten, flat index, neighbours, breadcrumb, the two-module case, first/last boundaries
- `isFocusRoute` — including near-misses: `/learn/tracks/x` false, `/learn/tracks/x/y` true
- progress math — `denom <= 0 → 100`, clamping, monotonicity

**Guards:** `npm run check:token-parity` covers `--icon-done` at no extra cost.

**E2E:** reader renders for a signed-in admin; TOC anchors resolve; prev/next navigate; signed-out shows the sign-in card and no persisted progress.

**Widen the existing nav suite.** `scripts/test-console-nav.ts` omits `/projects`, `/blogs`, `/community` and `FOOTER_NAV` — handoff follow-up #4. That gap already produced a real double-`aria-current` bug on `/learn/tracks`. SP3 adds a focus route to the nav model, so closing it here is not scope creep; it is the same file and the same risk.

---

## Follow-ups this spec creates

1. **Confirm or replace light `--icon-done`.** Same status as `--accent-violet`.
2. **Query + result pair** — needs an authored data shape before any directive is worth building. Content proposal, not UI work.
3. **Company / "Asked at" data** — needs a model. Note `docs/superpowers/plans/2026-05-17-companies-tagging.md` already exists and may cover it.
4. **Problem pass rate** — needs a stored aggregate or a `[problemId, status]` index on `Submission`. Meaningless until submission volume is real.
5. **Publish `analyst-interview-prep`** — a human decision, deliberately not made by SP3.
6. **SP4 replaces** the interim module-grouped list on `/learn/tracks/[slug]`.

## Out of scope

The Module screen (`06`), Learn hub (`03`), Tracks index (`07`) — SP4. The workspace and its lesson context bar — SP5. SP3 links out to the existing `/practice/[slug]`; the return path is SP5's to build.
