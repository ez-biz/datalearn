# Curriculum spine — design

**Status:** approved 2026-08-01
**Author:** Anchit (with Claude)
**Related:** `design_handoff_learning_platform` (Claude Design handoff, 2026-08-01), [`2026-05-22-learn-curriculum-design.md`](./2026-05-22-learn-curriculum-design.md), `docs/ROADMAP.md`
**Scope:** sub-project 1 of 7 in the learning-platform redesign. Headless — no learner-facing UI ships from this spec.

---

## Context

The Claude Design handoff turns Data Learn from "a practice tool with a learning section bolted on" into a learning platform. Its spine is an ordered curriculum — **track → module → lesson → checkpoint problems** — and every screen in the redesign is organised around answering "where am I and what is next".

That spine does not exist in the schema today:

- `Track → TrackItem → SQLProblem` is flat and problems-only. It has also **never been deployed** (see "Deploy prerequisite").
- `Topic → Article` is flat prose with no ordering and no membership in a track.
- There are no modules, no lesson↔problem checkpoint links, no per-user lesson read state, and no progress rollups.

Building the screens first would mean wiring them to fixtures and rebuilding them later. So the spine comes first.

### Content reality

The redesign is drawn for a library roughly 7× larger than what exists.

| | Production | Local | Design mocks |
| --- | --- | --- | --- |
| Problems | 59 | 23 | 412 |
| Articles (→ lessons) | 3 | 4 | 42 |
| Topics | 1 | 10 | 8+ |
| Tracks | *table absent* | 0 | 12 |
| Migrations applied | 19 of 28 | 28 | — |

A pixel-perfect rebuild against today's content renders as an empty shell. Authoring content is therefore **on the critical path of this sub-project**, not adjacent to it.

---

## Decomposition — where this sits

Seven sub-projects. Each gets its own spec → plan → implementation cycle. **This spec covers SP1 only.**

| # | Sub-project | Delivers | Depends on |
| --- | --- | --- | --- |
| **SP1** | **Curriculum spine** | `Module`, `ModuleLesson`, `LessonCheckpoint`, `LessonProgress`; rollup library; admin API + MCP tools; one authored track | — |
| SP2 | Tokens + shell | Graphite tokens (dark **and** light), `ConsoleSidebar` / `ConsoleRail` / mobile tab bar, persisted collapse state | — |
| SP3 | Lesson reader | 3-column reader, curriculum rail, read-progress + auto-complete, checkpoint block | SP1, SP2 |
| SP4 | Index screens | Learn hub, module, tracks index + detail, practice catalog | SP1, SP2 |
| SP5 | Workspace | Problems panel, lesson context bar, Solutions tab, collapsible schema, curriculum-aware verdict | SP2, SP1 |
| SP6 | Home + mobile | Signed-out marketing, dashboard (streaks, weak spots), three mobile screens | SP1–SP5 |
| SP7 | Admin redesign | Violet admin shell, overview queues + deltas, filtered problems list, tabbed problem form incl. Curriculum placement | SP1, SP2 |

**Deferred out of SP1, deliberately:**

- **Lesson URL scheme** — whether the reader lives at `/learn/tracks/[track]/[module]/[lesson]` or stays at `/learn/[topic]/[article]` with track context. The model supports both; SP3 decides.
- **Streaks and weak spots** — pure `Submission` + `Tag` queries needed only by the dashboard. SP6.
- **Admin curriculum-placement UI** — designed in handoff `8a`; SP7 consumes SP1's API.

---

## Deploy prerequisite — task zero

Production sits at **19 of 28 migrations** with no `Track` table, despite `vercel-build` running `prisma migrate deploy` on every build. The tracks feature has existed in code since May and has never been live.

SP1 adds four more migrations on top of that backlog. **Diagnosing and clearing it is the first task, before any schema work.** Otherwise the spine is unshippable and we discover that at the end rather than the start.

Likely causes to check, in order:

1. `production` branch is behind `main` — the migrations exist on `main` but were never released.
2. `prisma migrate deploy` is failing non-fatally during `vercel-build`, or a build step before it is short-circuiting.
3. A failed/partial migration row in `_prisma_migrations` is blocking subsequent ones.

Done criterion: production reports 28 of 28 applied and `/api/health` is green.

---

## Data model

Four new models. `Article`, `Topic`, `SQLProblem` and `Track` are **untouched**.

```prisma
model Module {
  id          String         @id @default(cuid())
  trackId     String
  track       Track          @relation(fields: [trackId], references: [id], onDelete: Cascade)
  /// Plain slug — "window-functions". The "04-" display prefix is derived
  /// from `position` at render time so reordering never breaks a URL.
  slug        String
  name        String
  description String         @db.Text
  position    Int
  lessons     ModuleLesson[]
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt

  @@unique([trackId, slug])
  @@unique([trackId, position])
  @@index([trackId])
}

/// An Article placed in a Module, in order. An Article may appear in more
/// than one Module — reuse across tracks is intentional.
model ModuleLesson {
  moduleId  String
  module    Module  @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  articleId String
  article   Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  position  Int

  @@id([moduleId, articleId])
  @@unique([moduleId, position])
  @@index([articleId])
}

/// A problem that checks a lesson. `@@unique([problemId])` enforces the
/// handoff's product rule: one problem belongs to exactly one lesson.
model LessonCheckpoint {
  articleId String
  article   Article    @relation(fields: [articleId], references: [id], onDelete: Cascade)
  problemId String
  problem   SQLProblem @relation(fields: [problemId], references: [id], onDelete: Cascade)
  position  Int

  @@id([articleId, problemId])
  @@unique([problemId])
  @@unique([articleId, position])
}

model LessonProgress {
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  articleId   String
  article     Article   @relation(fields: [articleId], references: [id], onDelete: Cascade)
  /// 0–100. Monotonic: writes take max(existing, incoming), never decrease.
  percent     Int       @default(0)
  completedAt DateTime?
  updatedAt   DateTime  @updatedAt

  @@id([userId, articleId])
  @@index([userId, completedAt])
}
```

### Decisions and their reasons

**Module slug excludes the number.** Stored as `window-functions` with `position: 4`; the breadcrumb renders `04-window-functions`. Reordering modules changes display, not URLs.

**`@@unique([trackId, position])` mirrors `TrackItem`.** The same house rule therefore applies: positions are mutable **only** inside a `reorderModules` transaction, never by direct write. Same for `ModuleLesson.position` and `LessonCheckpoint.position`.

**Checkpoints are a join table, not columns on `SQLProblem`.** The handoff proposes `nullable lessonId + checkpointOrder` on `SQLProblem`. The product semantics are identical either way, and `@@unique([problemId])` preserves them exactly — but the join table:

- leaves `SQLProblem` alone, avoiding the select-projection audit that `CLAUDE.md` explicitly requires across `actions/problems.ts`, `actions/profile.ts`, `actions/submissions.ts`, `actions/lists.ts` and every admin route;
- avoids a partial-unique across nullable columns;
- makes relaxing to many-to-many later a dropped constraint rather than a migration on the busiest table.

**Progress is keyed on the article, not on a track-scoped row.** Read a lesson once and it counts everywhere that lesson appears. Prev/next and the `14 / 37` counter are track-scoped and come from traversing the track, not from the progress row.

**`TrackItem` is left in place, untouched.** It has zero rows in every environment and is now redundant with module→lesson→checkpoint. Flag for a cleanup release; do not migrate or drop in SP1.

---

## Progress semantics

| Quantity | Rule |
| --- | --- |
| Lesson done | `LessonProgress.completedAt != null`, set when `percent` first reaches 100 |
| Percent write | `max(existing, incoming)` — monotonic, never decreases |
| Problem done | ≥1 `Submission` with `status = ACCEPTED` for that `(userId, problemId)`. Covered by the existing `@@index([userId, status])`. |
| Module % | `(lessonsDone + problemsDone) / (lessonsTotal + problemsTotal)`, `Math.round`ed. A module with no lessons and no problems is **0%**, not NaN. |
| Track % | The same formula rolled across all of the track's modules. A track with no content is 0%. |
| Module unlocked | `position == 0 \|\| previous module is 100%` |
| Signed out | Everything renders; nothing persists |

**The combined denominator is derived, not chosen.** The learn hub mock shows `13/37 lessons` beside `38%` on the same track. 13/37 is 35%, so problems must be inside the denominator.

**Unlocking is advisory and must never be enforced.** No route guard, no server-action rejection, no redirect. The handoff is explicit that skipping ahead is always permitted; the lock is a UI affordance only. Copy: **"Locked until 02"** (chosen over "Not started" because it names the dependency).

### Code layout

Following the existing `lib/tracks.ts` + `actions/tracks.ts` split:

- **`lib/curriculum-progress.ts`** — pure rollup math over already-fetched rows. Prisma-free, no React, unit-tested.
- **`actions/curriculum.ts`** — `"use server"` Prisma queries that fetch and delegate to the pure module.

---

## Migration of `Article.relatedProblems`

The implicit `ArticleProblems` m2m overlaps with `LessonCheckpoint` and currently powers `RelatedProblemsPanel` (article → problems) and `RelatedArticlesPanel` (problem → articles). The redesign's checkpoint block and "Comes from" card replace both.

Transition, following the legacy-window pattern the repo already uses for `expectedOutput`:

1. Backfill `LessonCheckpoint` from existing `ArticleProblems` pairs.
2. Keep `relatedProblems` in the schema for one release; repoint both panels at `LessonCheckpoint`.
3. Drop `relatedProblems` in a later cleanup release.

**Backfill hazard:** a problem linked to two articles violates `@@unique([problemId])`. The backfill must apply a deterministic tiebreak — **earliest `Article.createdAt` wins** — and **report every skipped pair** rather than failing silently or dropping data unannounced.

---

## Admin API

Slug-addressed throughout, matching every existing admin resource. All routes wrapped in `withAdmin`.

```
/api/admin/tracks/[slug]/modules                                     GET · POST
/api/admin/tracks/[slug]/modules/reorder                             POST { moduleSlugs[] }
/api/admin/tracks/[slug]/modules/[moduleSlug]                        GET · PATCH · DELETE
/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons                POST { articleSlug, position? }
/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons/reorder        POST { articleSlugs[] }
/api/admin/tracks/[slug]/modules/[moduleSlug]/lessons/[articleSlug]  DELETE
/api/admin/lessons/[articleSlug]/checkpoints                         GET · POST { problemSlug, position? }
/api/admin/lessons/[articleSlug]/checkpoints/reorder                 POST { problemSlugs[] }
/api/admin/lessons/[articleSlug]/checkpoints/[problemSlug]           DELETE
```

**Checkpoints hang off the article, not the module path.** `LessonCheckpoint` is keyed on `articleId` and a lesson may sit in several modules, so a module-scoped checkpoint path would be ambiguous.

Zod input schemas go in `lib/admin-validation.ts` alongside `TrackReorderInput` / `TrackItemAddInput`. **That file stays Prisma-free** — `npm run check:mcp-bundle-isolation` passing is a done criterion.

`PATCH` on a module accepts `name`, `slug`, `description`. It **rejects `position`** — position moves only through `reorder`.

---

## MCP tools

New `mcp-server/src/tools/curriculum.ts`, importing the validation schemas directly (tsup inlines them), following the shape of `tools/tracks.ts`:

- `list_modules`, `create_module`, `update_module`, `delete_module`, `reorder_modules`
- `add_lesson_to_module`, `remove_lesson_from_module`, `reorder_module_lessons`
- `list_checkpoints`, `add_checkpoint`, `remove_checkpoint`, `reorder_checkpoints`
- `get_curriculum` — returns the whole track tree in one call so an authoring assistant can see current state without N round-trips

**Publishing stays human.** Modules have no status field, so the `create_problem` DRAFT-guard pattern doesn't apply literally — but the equivalent rule does: attaching modules, lessons or checkpoints **never mutates `Track.status`**. Publishing a track remains a deliberate human action in the admin portal.

---

## Content — "Analyst interview prep"

The mock curriculum rail names the entire track, so this is transcription rather than invention.

| Module | Lessons |
| --- | --- |
| 01 Foundations | Reading a query plan in your head · SELECT, WHERE, and evaluation order · NULL is not a value · Sorting, paging, and ties |
| 02 Joins | Inner, left, and the unmatched rows · Semi and anti joins · Fan-out and row multiplication |
| 03 Aggregation | GROUP BY and the grain of a result · HAVING vs WHERE · COUNT(\*) vs COUNT(col) |
| 04 Window functions | What a window actually is · OVER, PARTITION BY, and frame clauses · LAG, LEAD, and row-to-row deltas · Top-N per group, three ways |
| 05 Interview patterns | Sessionisation · Cohort retention · Metric definitions that survive review |

17 lessons. Checkpoints are drawn from the 59 existing problems where they fit and authored where they don't. Problems named in the mocks: `#119` Duplicate emails, `#121` Orders per customer including zero, `#127` Departments above average salary, `#246` Rank products by category revenue, `#247` Second highest salary per department, `#248` 7-day rolling active users, `#249` First and last order per customer, `#251` Running total that resets monthly, `#288` Sessionise an event stream, `#292` Weekly cohort retention.

**This is the dominant cost of SP1.** 17 pieces of interview-grade SQL prose is real writing, not a seed script. Authoring runs through the MCP tools, the same path problems already use.

**Priority order if writing time forces a cut:** all 5 modules ship with real metadata regardless. Lessons are authored **04 Window functions first** (every mock depicts it) and **01 Foundations second** (it is the entry point). Modules 02, 03 and 05 gain lessons as they are written; a module with zero lessons renders as 0% and is not a failure state.

---

## Testing

All under `node --import tsx --test`, matching the existing `test:*` scripts.

| Script | Covers |
| --- | --- |
| `scripts/test-curriculum-progress.ts` | Rollup math, the unlock rule, the monotonic-percent invariant, empty-module and zero-denominator edge cases |
| `scripts/test-curriculum-admin-validation.ts` | The new Zod shapes, including `PATCH` rejecting `position` |
| `scripts/test-checkpoint-backfill.ts` | The tiebreak, and that skipped pairs are reported rather than dropped |
| `scripts/mcp-e2e-test.mjs` (extended) | The new tool surface against a live dev server |

Plus, as done criteria rather than new tests: `npm run check:mcp-bundle-isolation`, `npx tsc --noEmit`, and `npm run build` (with `--webpack`, never dropped).

---

## Out of scope

- Any learner-facing UI. SP1 ships nothing a signed-in user can see.
- Streaks, weak spots, "today's plan", median completion time, interview weight — SP6 and later.
- Assessment / placement ("Take the 12-min assessment" on the marketing hero) — not designed anywhere in the handoff beyond the CTA.
- Dropping `TrackItem` or `relatedProblems`. Both flagged for a cleanup release.
- Nav destinations the sidebar shows but the product lacks: Projects, Blogs, Community, Data modeling, Architecture design, Cloud labs. SP2 decides whether they render as disabled, hidden, or "coming soon".
