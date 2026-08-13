# SP4 — Index screens

> Design spec. Status: agreed 2026-08-13. Implementation plan to follow.
>
> Sub-project 4 of 7 in the learning-platform redesign. Depends on SP1 (curriculum spine) and SP2 (console shell + tokens), both merged. **Unblocks SP6**, which needs SP4 + SP5 and already has SP5.

## What this is

The three screens that let a learner find work — Practice catalog, Module, Tracks — rebuilt to the design handoff's sections 3–5 (screenshots `08`, `06`, `07`).

One of the three does not exist yet. SP3 shipped a module list inside the track detail page as an explicit stopgap, with a comment naming SP4 as its replacement:

```tsx
/* Interim entry point into the lesson reader. TrackItem has 0 rows
   locally, so without this nothing on the site links to a lesson.
   SP4's Module screen replaces this module-grouped list with the
   fully-designed version — do not gold-plate. */
```

## Decisions locked

Made during brainstorming on 2026-08-13. Don't relitigate without new information.

| Decision | Choice |
|---|---|
| Scope | Practice + Module + Tracks. The Learn hub (screenshot `03`) is **not** in SP4 |
| Unbacked design blocks | **Omit all.** No migrations anywhere in SP4 |
| `TrackItem` study sequence | **Keep as a fallback** — modules when the track has them, study sequence when it doesn't |
| Module route | `/learn/tracks/<track>/modules/<module>`, and **no module index route** |
| Catalog filter state | Local, not URL-synced |

### What "omit all" removes

`Track` has no `kind` field and `Module` has no editorial fields, so these design elements do not ship:

- the All / Career / Skill segmented filter on the Tracks index, and the Career/Skill chip on each track card;
- the Module screen's "After this module you can" card (four authored outcomes);
- Module facts' *median completion* and *interview weight*.

This follows the SP3 rule — blocks with no backing data are omitted, not faked — and keeps SP4 free of migrations, which makes every phase revertible by reverting one PR.

**More survives than expected.** Two right-rail cards that looked unbacked are derivable: Prerequisites is the earlier modules' rollups (what `isModuleUnlocked` already computes), and Module facts' reading time and problem count come from `Article.readingMinutes` and the checkpoints.

---

## 1. Routes and shell

| Route | Today | SP4 |
|---|---|---|
| `/practice` | `PracticeList` with inline filters | facet rail + sort toolbar + denser table |
| `/learn/tracks` | `TrackCard` grid | cards with progress + Resume |
| `/learn/tracks/[slug]` | SP3 stopgap + study sequence | module rows, study sequence as fallback |
| `/learn/tracks/[slug]/modules/[moduleSlug]` | **does not exist** | new |

**All four are normal shell routes** — not focus, not app. They keep `<Footer>` and page scroll, because they are documents you scroll rather than application views. `ConsoleChrome` needs no change: SP4 is the first sub-project since SP2 that does not touch the shell.

### The route-shape constraint

`isFocusRoute` matches **any** 4-segment path under `learn/tracks`:

```ts
segments.length === 4 && segments[0] === "learn" && segments[1] === "tracks"
```

So `/learn/tracks/<track>/modules` would be treated as the lesson reader and lose the console shell. The module screen therefore lives at a **5-segment** path, which the predicate cannot match, and **no module index route is created** — the track detail already lists the modules, so an index would be redundant as well as colliding.

`isFocusRoute` itself is unchanged. What SP4 adds is the assertion: the real module URL goes into the mutual-exclusivity fixture in `scripts/test-console-nav.ts`, and a comment records why the 4-segment sibling is deliberately absent.

**Noted for later, not acted on now:** this is the second 4th-segment collision to shape a decision, after `/practice/tags` forced an exclusion in `isAppRoute`. Both predicates are structural with exactly one carve-out each. A third would be the signal to replace segment-counting with an explicit route registry. Two is not.

---

## 2. Practice catalog

### Everything the design asks for is backed

| Design element | Source |
|---|---|
| Status facet (solved / attempted / todo) | `Submission` — accepted for solved, any row for attempted |
| Difficulty facet | `SQLProblem.difficulty` |
| Engine facet | `SQLProblem.dialects` |
| Topic chips, Company rows | `Tag.kind` — `TOPIC` / `COMPANY` |
| Pass-rate column | `attemptCount` / `acceptedCount` — **new in SP5** |
| Sort: Curriculum order | `modulePosition` from the curriculum join |
| Sort: Newest | `SQLProblem.createdAt` |
| Sort: Pass rate | the SP5 counters |

The pass-rate column is the one SP3 omitted for having no data. SP5 made it real.

### One query, two consumers

`getWorkspaceProblemsPanel` already returns number, slug, title, difficulty, solved, module context, tags and both counters — which is the catalog, viewed sideways. SP4 extends it with `dialects`, tag **kind**, `createdAt` and an attempted flag, and renames it:

```ts
// lib/practice/catalog-read.ts
export const getCatalogProblems = cache(
    async (userId: string | null, allowDraft = false): Promise<CatalogProblem[]> => …
)
```

Two consumers — the catalog and the workspace problems panel — one definition of "a problem in a list". Not a `"use server"` module, for the same reason `lib/curriculum-read.ts` isn't: it takes an explicit `userId`.

### Pure model

`lib/practice/catalog-model.ts`, mirroring `problems-panel-model.ts`: facet counts, multi-select filtering, the three sorts, and the "Showing 8 of 412" arithmetic.

**The load-bearing rule: a facet's counts must reflect the other facets' current selections but not its own.** Otherwise selecting "Medium" makes every difficulty count read 0 except Medium, and the numbers contradict the rows on screen. This is the first assertion to write.

### Filter state stays local

The whole catalog is already in memory client-side, so filtering is instant and URL sync buys nothing but re-render churn. Shareable filtered links are a genuine loss — logged as a follow-up rather than built.

### Layout

Two columns `236px 1fr` inside the shell. Facet rail on `panel`. Header with mono "CATALOG", h1, description and three right-aligned stats (Solved in `primary`, Attempted, "% of catalog" in `warning`). Toolbar on `panel-sunken` with the mono segmented sort and the filtered count. Table on `grid 34px 62px 1fr 120px 90px 78px 20px` with 1px `line-faint` row rules and a `panel-raised` header.

---

## 3. Module screen

### Data

One existing read: `getTrackCurriculumForUser(trackSlug, userId, { allowDraft })`. SP4 selects one module out of the result. Staff get `allowDraft`, exactly as the reader does.

### Layout

A mono breadcrumb bar on `panel-sunken` (`<track-slug> / <module-slug>`, "Module 4 of 6" right-aligned in `primary`), then two columns `1fr 340px`.

Left: h1, a 62ch description, a `primary` "Resume lesson N" button, a progress bar with `N of M lessons · N of M problems`, then **Lessons** as rows of `grid 18px 34px 1fr 130px 60px` — state icon, number, title, state chip, duration — then **Attached problems**.

Right rail: **Prerequisites** (earlier modules with a check when complete) and **Module facts** (reading time, problem count). The other two cards are omitted per the decision above.

### The locked state is a chip, never a gate

`isModuleUnlocked` is advisory by an explicit CLAUDE.md rule. It drives the "Locked until 02" copy and nothing else. **A locked module's page renders in full, every lesson is clickable, and no request is rejected.** Skipping ahead stays permitted by design.

### Pure model

`lib/learn/module-model.ts`: which lesson "Resume" points at (first incomplete; the first lesson when the module is complete), per-lesson state (`done` / `in-progress` / `todo`), and the facts arithmetic.

### Attached problems reuse the catalog row

The design calls them "a compact version of the practice table". One row component shared with §2, so the two cannot drift.

### Not found

An unknown module slug calls `notFound()`. **`notFound()` returns HTTP 200 app-wide** — Next commits the status before the throw — so the test asserts the body, not the status. This is the first new route since that was written down (handoff follow-up 8).

---

## 4. Tracks index and detail

Screenshot `07` shows both on one canvas; they are two routes. The dashed rule between them is a mock artifact, not a divider to build.

### The index needs progress without N queries

Every card wants a bar, a percentage and "Resume →", which means rolling up each track for the current user. Rather than calling `getTrackCurriculumForUser` once per track:

```ts
// lib/learn/tracks-read.ts
export const getTrackSummariesForUser = cache(
    async (userId: string | null, allowDraft = false): Promise<TrackSummary[]> => …
)
```

**Three queries regardless of track count** — published tracks with their modules/lessons/checkpoints, the user's completed articles, the user's accepted problems — then rolled up in memory with the existing pure `rollUpModule` / `rollUpTrack`. One track exists today; this is cheap insurance, and the shape matters before a second lands.

### Cards

Number chip, title, description, a mono `N lessons · N problems · N hrs` line, and a progress row of `bar · percentage · Resume →`. No kind chip, no segmented filter — see the omit decision.

### Detail

Module rows of `grid 34px 1fr 110px 130px 90px`. Right rail: a `primary`-bordered progress card (percentage, bar, lessons / problems / est. remaining, "Continue module N") and the **Rules of the path** card.

"est. remaining" is derivable — remaining lessons × `readingMinutes`.

**Rules of the path stays**, despite being static copy with no data behind it. It is the only screen anywhere that tells a learner the actual rules: a module unlocks when the previous completes, lessons auto-complete on read, problems complete on an accepted submission, **and skipping ahead is always allowed**. That last line is the user-facing statement of the advisory-unlock rule CLAUDE.md protects in code.

### The TrackItem fallback

Module rows when the track has modules; the existing study-sequence list when it does not. `TrackItem` has 0 rows locally but a full admin REST + MCP authoring surface, and production still runs the old tracks feature — so a track authored under the old model must not render an empty page after the release. One conditional; the model, routes and tools are untouched.

---

## 5. Testing

Three new suites, all pure, **each wired into `.github/workflows/test.yml` in the PR that adds it**.

| Suite | Covers |
|---|---|
| `test:catalog-model` | facet counts under other selections, multi-select filtering, three sorts, filtered-count arithmetic |
| `test:module-model` | resume-lesson resolution, per-lesson state, facts arithmetic |
| extend `test:console-nav` | the real module URL in the mutual-exclusivity fixture |

Plus e2e for the module route and the catalog's facets.

### Capability inventory

Things that exist, appear in no design screen, and would vanish silently in a rebuild:

| Capability | Where |
|---|---|
| DuckDB-WASM + PGlite prefetch that warms the SQL engine | `components/practice/PracticeList.tsx` |
| `/` keyboard shortcut focusing search | `PracticeList` |
| Tag-pill overflow (`MOBILE_TAG_LIMIT`) on narrow screens | `PracticeList` |
| `TrackItemRow` study sequence | `app/learn/tracks/[slug]/page.tsx` |
| Tag index and detail routes | `app/practice/tags/**` — out of scope, must not break |

**Two of these were checked during design rather than assumed:**

- `tracks.spec.ts` **does** seed `TrackItem` rows and assert them, so the fallback path is already covered by an existing test.
- `learn.spec.ts`'s cross-link assertion fetches `/practice/<slug>` — the **workspace**, not the catalog. The catalog rebuild does not touch it.

---

## Phases

Four PRs against `main`, each independently mergeable, **zero migrations across all four**.

1. **Shared read** — extend and rename `getWorkspaceProblemsPanel` → `getCatalogProblems`; update the workspace panel to consume it; prove the workspace is unchanged. No new UI. This is the de-risking step: the only phase touching already-shipped working code.
2. **Practice catalog** — facet rail, sort toolbar, table, pure model.
3. **Module screen** — the new route, its model, and the predicate test.
4. **Tracks index and detail** — summaries read, cards, detail, TrackItem fallback.

**SP6 unblocks when phase 4 lands.**

## Open questions

Two things this spec decided on its own authority. Both are cheap to change before phase 2 and expensive after.

1. **Filter state is local, not URL-synced.** Shareable filtered catalog links are a real loss; the trade was instant filtering with no round trip.
2. **The Learn hub (`/learn`, screenshot `03`) is out of scope.** The design bundle marks it "build this one", so leaving it means the entry point above these screens stays pre-redesign until SP6 or a follow-up.

## References

- Design bundle `~/Downloads/design_handoff_learning_platform 2/` (local, uncommitted) — README sections 3–5, screenshots `06`, `07`, `08`
- SP5 spec `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md` — the `isAppRoute` precedent and the pure-model pattern
- SP1 spec `docs/superpowers/specs/2026-08-01-curriculum-spine-design.md` — rollups and the advisory-unlock rule
- Handoff `docs/superpowers/handoff/2026-08-12-sp5-complete-handoff.md` — environment traps and the release ordering
