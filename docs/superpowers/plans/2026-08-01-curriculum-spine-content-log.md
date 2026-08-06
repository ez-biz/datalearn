# Curriculum spine content log — Analyst Interview Prep track

Authoring record for the `analyst-interview-prep` Track (Task 12,
`.superpowers/sdd/2026-08-01-curriculum-spine/task-12-brief.md`). The
brief originally called for authoring this content live through the MCP
tools; that was superseded by shipping the track as a committed,
re-runnable seed script instead — see the header comment in
`prisma/seed-analyst-track.ts` and
`docs/superpowers/plans/2026-08-01-curriculum-spine.md` (commit
`90822c6`). This doc is the authoring record the original brief asked
for, adapted to that delivery mechanism.

## How to run it

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' \
  npx tsx prisma/seed-analyst-track.ts
```

(or `npm run seed:analyst-track` once `DATABASE_URL` is exported).
**Local Postgres only** — never against `.env.local`'s Neon branch or
`.env.production.local`.

Idempotent: every write goes through an upsert or an explicit
before/after comparison (`changed` for `Article`, `trackChanged` for
`Track`), so re-running against a database that already has this
content is a true no-op — no duplicate rows, no `updatedAt` churn, no
`ArticleVersion` growth. Verified by running it twice in a row; see the
Task 12 fix-round report for the exact before/after counts and
timestamps.

## Every lesson

17 lessons across 5 modules, in position order. Word count is the
prose word count (fenced code blocks excluded, matching
`computeReadingMinutes()` in `lib/admin-validation.ts`); `readingMinutes`
is that same function's output, stored on the `Article` row.

| module (pos) | lesson (pos) | slug | words | readingMinutes |
| --- | --- | --- | --- | --- |
| foundations (0) | 0 | `reading-a-query-plan-in-your-head` | 809 | 5 |
| foundations (0) | 1 | `select-where-and-evaluation-order` | 719 | 4 |
| foundations (0) | 2 | `null-is-not-a-value` | 844 | 5 |
| foundations (0) | 3 | `sorting-paging-and-ties` | 794 | 4 |
| joins (1) | 0 | `inner-left-and-the-unmatched-rows` | 868 | 5 |
| joins (1) | 1 | `semi-and-anti-joins` | 723 | 4 |
| joins (1) | 2 | `fan-out-and-row-multiplication` | 758 | 4 |
| aggregation (2) | 0 | `group-by-and-the-grain-of-a-result` | 715 | 4 |
| aggregation (2) | 1 | `having-vs-where` | 725 | 4 |
| aggregation (2) | 2 | `count-star-vs-count-col` | 736 | 4 |
| window-functions (3) | 0 | `what-a-window-actually-is` | 766 | 4 |
| window-functions (3) | 1 | `over-partition-by-and-frame-clauses` | 717 | 4 |
| window-functions (3) | 2 | `lag-lead-and-row-to-row-deltas` | 764 | 4 |
| window-functions (3) | 3 | `top-n-per-group-three-ways` | 840 | 5 |
| interview-patterns (4) | 0 | `sessionisation` | 808 | 5 |
| interview-patterns (4) | 1 | `cohort-retention` | 768 | 4 |
| interview-patterns (4) | 2 | `metric-definitions-that-survive-review` | 763 | 4 |

All 17 are `PUBLISHED`. Titles match the slugs 1:1 (e.g.
`inner-left-and-the-unmatched-rows` → "INNER, LEFT, and the Unmatched
Rows") — see `CURRICULUM` in `prisma/seed-analyst-track.ts` for full
titles, summaries, and bodies.

## Checkpoint mapping (lesson → problem)

17 checkpoints wired across 15 distinct published problems (2 lessons —
`semi-and-anti-joins` and `over-partition-by-and-frame-clauses` — use 2
problems each; `top-n-per-group-three-ways` uses 3).

| lesson | problem slug | problem # | problem title |
| --- | --- | --- | --- |
| `reading-a-query-plan-in-your-head` | `highest-spending-customer` | 16 | Highest-Spending Customer |
| `select-where-and-evaluation-order` | `orders-in-january-2023` | 5 | Orders in January 2023 |
| `null-is-not-a-value` | `products-never-ordered` | 8 | Products Never Ordered |
| `sorting-paging-and-ties` | `largest-department` | 11 | Largest Department by Headcount |
| `inner-left-and-the-unmatched-rows` | `total-revenue-per-customer` | 2 | Total Revenue Per Customer |
| `semi-and-anti-joins` | `customers-with-orders` | 12 | Customers Who Have Ordered |
| `semi-and-anti-joins` | `customers-with-no-orders` | 23 | Customers Who Have Never Ordered |
| `fan-out-and-row-multiplication` | `top-selling-products` | 3 | Top Selling Products |
| `group-by-and-the-grain-of-a-result` | `avg-salary-per-department` | 15 | Average Salary per Department |
| `having-vs-where` | `customers-with-multiple-orders` | 7 | Customers with Multiple Orders |
| `count-star-vs-count-col` | `orders-per-country` | 14 | Orders per Country |
| `what-a-window-actually-is` | `running-revenue` | 18 | Running Revenue by Order Date |
| `over-partition-by-and-frame-clauses` | `salary-vs-department-avg` | 19 | Salary vs Department Average |
| `over-partition-by-and-frame-clauses` | `employee-salary-rank` | 17 | Employee Salary Rank by Department |
| `top-n-per-group-three-ways` | `top-2-products-per-category` | 20 | Top 2 Priced Products per Category |
| `top-n-per-group-three-ways` | `highest-paid-per-department` | 10 | Highest-Paid Employee per Department |
| `top-n-per-group-three-ways` | `most-recent-hire-per-dept` | 22 | Most Recent Hire per Department |

**Zero new problems were authored** for this track. Every checkpoint
above maps to a problem that already existed and was already
`PUBLISHED` before this task started.

### Imperfect but included: `count-star-vs-count-col` → `orders-per-country`

`orders-per-country` (#14) is the closest available published problem to
this lesson's topic — it exercises `COUNT(*)` grouped aggregation — but
it's an imperfect match: no fixture column in the seeded schemas
(`ecommerce`, `hr`) actually carries a `NULL` value, so the problem
cannot demonstrate the `COUNT(*)` vs. `COUNT(column)` NULL-skipping
divergence the lesson is centrally about. The lesson body says this
explicitly rather than pretending the checkpoint is a clean fit; it
demonstrates the divergence the fixture *can* show honestly
(`COUNT(*)`/`COUNT(customer_id)` vs. `COUNT(DISTINCT customer_id)` on
`orders`, which do diverge on real data because customer 1 has two
orders) and covers the NULL-skipping half with a clearly-labeled
hypothetical (`shipped_date`) instead of fabricating a fixture that
doesn't exist.

## Lessons with no checkpoint (4)

All 23 published problems were checked against these four lessons (both
at initial authoring and again on a later re-check specifically for the
three `interview-patterns` lessons); none is a reasonable fit, and none
was forced. No new problems were authored to fill these gaps, per this
task's explicit instruction not to invent or author new problems.

- **`lag-lead-and-row-to-row-deltas`** (window-functions) — no published
  problem uses `LAG`/`LEAD` or asks for a row-to-row delta (period-over-
  period change, streak/gap detection). The closest candidates
  (`running-revenue`, `salary-vs-department-avg`) are running-total and
  partition-average problems, not neighbor-row comparisons.
- **`sessionisation`** (interview-patterns) — no published problem models
  an event log (actor + timestamp, many rows per actor). The lesson body
  is explicit that it repurposes the `orders` table as a stand-in event
  log for its own worked example, but that's a lesson-content choice, not
  a checkpoint — no *problem* in the bank is shaped as a sessionization
  task.
- **`cohort-retention`** (interview-patterns) — no published problem
  models a cohort/signup table or a retention-by-period computation, for
  the same reason: nothing in the fixture bank is shaped as a
  cohort/retention task, even though the lesson body derives a small
  cohort table from `orders` for its own worked example.
- **`metric-definitions-that-survive-review`** (interview-patterns) — this
  lesson isn't about SQL syntax at all (it's about writing an auditable
  metric spec before writing SQL), so there is no SQL problem that could
  meaningfully check it regardless of what the fixture data looks like.

## Track-level state

`Track.status` is deliberately left `"DRAFT"` in `TRACK` even though all
5 modules now carry full, `PUBLISHED` lesson prose. Flipping the track
live (making it visible/enrollable to real users) is a separate decision
for whoever owns that call, not something inferred from "the content is
done."

This is enforced structurally, not just by convention: the seed's
`Track.upsert` writes `status` on **create only**. The `update:` branch
never includes `status` at all, and the before/after comparison that
decides whether to write anything (`trackChanged`) doesn't compare it
either — status isn't a field this script's update path can touch, full
stop. Concretely, that means:

- A brand-new track is created with `status: "DRAFT"` — a track always
  starts as a draft.
- If a human later publishes the track through the admin portal
  (`Track.status` → `PUBLISHED`) and this seed is re-run — which a
  re-runnable, production-targetable script explicitly invites — the
  re-run leaves it `PUBLISHED`. The seed cannot see or revert that change.
- Verified directly: manually set `Track.status` to `PUBLISHED` via a raw
  update, re-ran the seed, confirmed the row was still `PUBLISHED`
  afterward and `Track.updatedAt` had not moved (the update branch never
  fired, because none of the five fields it actually compares —
  `name`/`summary`/`description`/`difficulty`/`estimatedMinutes` — had
  changed). See the Task 12 fix-round-2 report for the exact commands and
  output.

To publish this track for real, change `Track.status` directly (through
the admin portal, or a one-off script) — not by editing `TRACK.status` in
this file, which the seed will never write past track creation.

### `Article.status`: same fix, applied deliberately (resolved)

The same risk shape existed one level down, on `Article.status`. It was
initially flagged rather than fixed unilaterally (see the fix-round-2
report), and the decision was then made explicitly by the task owner:
**an admin's unpublish must stick.**

`upsertLessonArticle`'s `changed` comparison and the upsert's `update:`
object both dropped `status`, mirroring the `Track` fix above exactly —
`status` still appears in `create:` so a genuinely new lesson still
publishes, but an update can never touch it. Content fields
(`title`/`content`/`summary`/`topicId`/`readingMinutes`/`hasVisualBlocks`)
still drive both the update and the `ArticleVersion` snapshot exactly as
before; only `status`'s influence on those two was removed.

Verified empirically: with `having-vs-where` manually set to `DRAFT`
(simulating an admin pulling it to fix an error), a re-run of the seed
now leaves it `DRAFT` — `articles updated=0`, `Article.updatedAt`
unmoved. A genuine content edit on a different lesson in the same run
still updates the row and takes a fresh `ArticleVersion` snapshot,
confirming the `changed` guard's content-comparison behavior is
unaffected. See the Task 12 fix-round-3 report for the exact commands
and output.
