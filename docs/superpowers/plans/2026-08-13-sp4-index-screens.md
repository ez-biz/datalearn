# SP4 Index Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the three screens a learner uses to find work — Practice catalog, Module, Tracks — to the design handoff's sections 3–5, creating the Module route that does not yet exist.

**Architecture:** One shared read (`getCatalogProblems`) serves both the catalog and the workspace problems panel, since they are the same list viewed differently. All decision logic — facet counts, filtering, sorting, resume resolution — lives in pure modules under `lib/practice/` and `lib/learn/` so it unit-tests without a DOM. No schema changes anywhere: every design block with no backing data is omitted, which makes each of the four phases revertible by reverting one PR.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 + PostgreSQL, Tailwind v4 with HSL token variables, `node --import tsx --test` for unit suites, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-13-sp4-index-screens-design.md`

## Global Constraints

- **Four phases, four PRs, each `gh pr create --base main`.** The default branch is `production`; a forgotten `--base` deploys unfinished work to live.
- **Every new test script gets its line in `.github/workflows/test.yml` in the same PR that adds it.** Not a follow-up.
- **Zero migrations in this sub-project.** If a task seems to need one, stop — it means an omitted design block crept back in.
- **Judge suites by exit code, never by grepping output.** Local is Node 26 (`ℹ pass 51`), CI is Node 20 (`# pass 51`).
- **Do not reach for `fs.globSync`** — it landed in Node 22 and CI pins Node 20. Use a recursive `readdirSync` walk.
- **Semantic tokens only.** No hardcoded hex, no `slate-*`/`blue-*`. `npm run check:token-parity` and `npm run check:theme-utilities` both enforce this; the latter catches a token that exists but was never mapped in `@theme inline`.
- **No emoji icons.** Lucide SVG only.
- **`npm run build` — never bare `next build`.** Turbopack panics on this code shape.
- **Never export a `userId`-parameterised function from a `"use server"` file.** Every export is a client-callable RPC endpoint. Reads that take `userId` live in `lib/`, following `lib/curriculum-read.ts`.
- **`isModuleUnlocked` is advisory only.** It may drive copy and nothing else — never a route guard, never a rejected action. Skipping ahead is always permitted.
- **`npm run test:e2e` serves the last `npm run build`.** Rebuild before testing UI changes.
- **Playwright reuses a running server.** When changing `DATABASE_URL`, `lsof -ti :3100 | xargs kill -9` first.
- **After any `prisma/schema.prisma` change run `npx prisma generate`** — but this plan changes no schema, so needing it is a red flag.

## Capability inventory

Behaviours that exist today, appear in **no** design screen, and would vanish silently in a rebuild. Task 11 walks this table by hand.

| Capability | Lives in |
|---|---|
| DuckDB-WASM + PGlite prefetch that warms the SQL engine before a problem opens | `components/practice/PracticeList.tsx` |
| `/` keyboard shortcut focusing the search box | `components/practice/PracticeList.tsx` |
| Tag-pill overflow (`MOBILE_TAG_LIMIT`) on narrow screens | `components/practice/PracticeList.tsx` |
| `TrackItemRow` study sequence | `app/learn/tracks/[slug]/page.tsx` |
| Tag index + detail routes | `app/practice/tags/**` — out of scope, must not break |

Two were resolved during design and need no further checking: `tracks.spec.ts` **does** seed `TrackItem` rows and assert them, so the fallback path is covered; and `learn.spec.ts`'s cross-link test fetches `/practice/<slug>` — the **workspace**, not the catalog.

---

## Phase 1 — The shared read

PR title: `refactor(practice): share one problem-list read between catalog and workspace`

The de-risking phase: it is the only one that touches already-shipped working code, and it ships no new UI.

### File Structure

- Create: `lib/practice/catalog-read.ts` — `getCatalogProblems`, the single list read
- Delete: `lib/workspace/queries.ts`'s `getWorkspaceProblemsPanel` (the checkpoint-context read stays)
- Modify: `lib/workspace/problems-panel-model.ts` — `PanelProblem` becomes an alias of `CatalogProblem`
- Modify: `app/practice/[slug]/page.tsx` — import from the new module

---

### Task 1: Extend and move the shared read

**Files:**
- Create: `lib/practice/catalog-read.ts`
- Modify: `lib/workspace/queries.ts`, `lib/workspace/problems-panel-model.ts`, `app/practice/[slug]/page.tsx`
- Test: `scripts/test-problems-panel.ts` (already in CI — no workflow change this task)

**Interfaces:**
- Consumes: nothing new.
- Produces:

```ts
// lib/practice/catalog-read.ts
export type CatalogProblem = {
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    solved: boolean
    /** True when the viewer has any submission, accepted or not. */
    attempted: boolean
    moduleId: string | null
    modulePosition: number | null
    moduleTitle: string | null
    /** Tag slugs split by kind, for the two facet groups. */
    topicTags: string[]
    companyTags: string[]
    dialects: ("DUCKDB" | "POSTGRES")[]
    attemptCount: number
    acceptedCount: number
    createdAt: Date
}

export const getCatalogProblems: (
    userId: string | null,
    allowDraft?: boolean
) => Promise<CatalogProblem[]>
```

- [ ] **Step 1: Write the failing test**

`PanelProblem` is about to become an alias, so the existing suite must keep passing against the new shape. Append to `scripts/test-problems-panel.ts`:

```ts
import type { CatalogProblem } from "../lib/practice/catalog-read"

describe("CatalogProblem powers the panel model", () => {
    it("is structurally usable as a PanelProblem", () => {
        // A compile-time guarantee expressed as a runtime no-op: if the two
        // types diverge, tsc fails before this test ever runs.
        const row: CatalogProblem = {
            number: 1,
            slug: "s",
            title: "T",
            difficulty: "EASY",
            solved: false,
            attempted: false,
            moduleId: null,
            modulePosition: null,
            moduleTitle: null,
            topicTags: [],
            companyTags: [],
            dialects: ["DUCKDB"],
            attemptCount: 0,
            acceptedCount: 0,
            createdAt: new Date(1_700_000_000_000),
        }
        const groups = buildPanelGroups([row], "track", "")
        assert.equal(groups[0].problems[0].slug, "s")
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:problems-panel`
Expected: FAIL — `lib/practice/catalog-read` does not exist.

- [ ] **Step 3: Create the read**

Move the body of `getWorkspaceProblemsPanel` from `lib/workspace/queries.ts` into `lib/practice/catalog-read.ts` and extend it:

- add `dialects: true`, `createdAt: true` to the `select`;
- select `tags: { select: { slug: true, kind: true } }` and split into `topicTags` / `companyTags` by `kind === "COMPANY"`;
- fetch attempted alongside solved — one `findMany` on `Submission` with `distinct: ["problemId"]` and **no status filter** gives the attempted set; the existing accepted query gives solved.

Keep everything else identical: `excludeLockedProblems({ status: "PUBLISHED" })`, the DRAFT-track rule, `cache()`, and the file-top comment explaining why this is not a `"use server"` module.

**`lowestModule` is shared and must not be duplicated.** `lib/workspace/queries.ts` defines it and `getCheckpointContext` — which stays there — still uses it. Move it to `lib/practice/catalog-read.ts` and import it back into `queries.ts`, or lift it into a small `lib/curriculum-module-pick.ts`. Two copies would let the lowest-position tiebreak drift between the catalog and the workspace's breadcrumb, which is exactly the SP3 rule this helper encodes.

In `lib/workspace/problems-panel-model.ts`, replace the `PanelProblem` definition with:

```ts
import type { CatalogProblem } from "@/lib/practice/catalog-read"

/**
 * The panel and the catalog render the same rows. One definition of "a
 * problem in a list" means the two screens cannot drift.
 */
export type PanelProblem = CatalogProblem
```

Delete `getWorkspaceProblemsPanel` from `lib/workspace/queries.ts` and update `app/practice/[slug]/page.tsx` to import `getCatalogProblems`.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:problems-panel && npx tsc --noEmit`
Expected: both exit 0. The panel suite's count rises by 1.

- [ ] **Step 5: Prove the workspace is unchanged**

Run: `npm run build` then `lsof -ti :3100 | xargs -r kill -9` then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- workspace sql-engine`
Expected: all pass. These assert the panel's grouping, the panel toggle and the engine behaviour — if the read regressed, they fail.

Then check the data directly, because a passing UI test does not prove the new fields are populated:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsx -e "
import {getCatalogProblems} from './lib/practice/catalog-read'
getCatalogProblems(null,true).then(r=>{
  console.log('rows', r.length)
  console.log('sample', JSON.stringify(r[0], null, 1))
  console.log('with dialects', r.filter(x=>x.dialects.length>0).length)
  console.log('with topic tags', r.filter(x=>x.topicTags.length>0).length)
  process.exit(0)})"
```
Expected: every row has a non-empty `dialects` and a real `createdAt`.

- [ ] **Step 6: Commit and open the phase 1 PR**

```bash
git add lib/practice/catalog-read.ts lib/workspace scripts/test-problems-panel.ts "app/practice/[slug]/page.tsx"
git commit -m "refactor(practice): share one problem-list read between catalog and workspace"
gh pr create --base main --title "refactor(practice): share one problem-list read between catalog and workspace"
```

> No workflow file touched in this phase, so this PR can merge from the CLI.

---

## Phase 2 — Practice catalog

PR title: `feat(practice): rebuild the catalog with facets, sorting and pass rate`

### File Structure

- Create: `lib/practice/catalog-model.ts` — facets, filtering, sorting. Pure.
- Create: `scripts/test-catalog-model.ts`
- Create: `components/practice/catalog/FacetRail.tsx`, `CatalogToolbar.tsx`, `CatalogTable.tsx`, `CatalogRow.tsx`
- Modify: `app/practice/page.tsx`
- Delete: `components/practice/PracticeList.tsx` (absorbed)

---

### Task 2: The catalog model

**Files:**
- Create: `lib/practice/catalog-model.ts`
- Test: `scripts/test-catalog-model.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Consumes: `CatalogProblem` from Task 1.
- Produces:

```ts
export type CatalogSort = "curriculum" | "newest" | "pass-rate"

export type CatalogFilters = {
    status: ("solved" | "attempted" | "todo")[]
    difficulty: ("EASY" | "MEDIUM" | "HARD")[]
    engine: ("DUCKDB" | "POSTGRES")[]
    topics: string[]
    companies: string[]
    search: string
}

export type FacetCount = { value: string; label: string; count: number }

export type CatalogFacets = {
    status: FacetCount[]
    difficulty: FacetCount[]
    engine: FacetCount[]
    topics: FacetCount[]
    companies: FacetCount[]
}

export const EMPTY_FILTERS: CatalogFilters

export function filterCatalog(
    problems: CatalogProblem[],
    filters: CatalogFilters,
    sort: CatalogSort
): CatalogProblem[]

export function computeFacets(
    problems: CatalogProblem[],
    filters: CatalogFilters
): CatalogFacets
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-catalog-model.ts`:

```ts
// Unit tests for the practice-catalog facet, filter and sort model.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-catalog-model.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    EMPTY_FILTERS,
    computeFacets,
    filterCatalog,
    type CatalogFilters,
} from "../lib/practice/catalog-model"
import type { CatalogProblem } from "../lib/practice/catalog-read"

function p(over: Partial<CatalogProblem>): CatalogProblem {
    return {
        number: 1,
        slug: "s",
        title: "T",
        difficulty: "EASY",
        solved: false,
        attempted: false,
        moduleId: null,
        modulePosition: null,
        moduleTitle: null,
        topicTags: [],
        companyTags: [],
        dialects: ["DUCKDB"],
        attemptCount: 0,
        acceptedCount: 0,
        createdAt: new Date(1_700_000_000_000),
        ...over,
    }
}

function withFilters(over: Partial<CatalogFilters>): CatalogFilters {
    return { ...EMPTY_FILTERS, ...over }
}

describe("filterCatalog — status", () => {
    it("solved matches only accepted problems", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "tried", attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(rows, withFilters({ status: ["solved"] }), "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["done"])
    })

    it("todo means neither solved nor attempted", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "tried", attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(rows, withFilters({ status: ["todo"] }), "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["fresh"])
    })

    it("attempted excludes solved, so the three statuses partition the catalog", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "tried", attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(rows, withFilters({ status: ["attempted"] }), "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["tried"])
    })

    it("selecting several statuses is a union", () => {
        const rows = [
            p({ slug: "done", solved: true, attempted: true }),
            p({ slug: "fresh" }),
        ]
        const out = filterCatalog(
            rows,
            withFilters({ status: ["solved", "todo"] }),
            "curriculum"
        )
        assert.equal(out.length, 2)
    })
})

describe("filterCatalog — combining groups", () => {
    it("different groups intersect", () => {
        const rows = [
            p({ slug: "a", difficulty: "EASY", dialects: ["DUCKDB"] }),
            p({ slug: "b", difficulty: "EASY", dialects: ["POSTGRES"] }),
            p({ slug: "c", difficulty: "HARD", dialects: ["DUCKDB"] }),
        ]
        const out = filterCatalog(
            rows,
            withFilters({ difficulty: ["EASY"], engine: ["DUCKDB"] }),
            "curriculum"
        )
        assert.deepEqual(out.map((r) => r.slug), ["a"])
    })

    it("a problem matches an engine facet if it supports it at all", () => {
        const rows = [p({ slug: "both", dialects: ["DUCKDB", "POSTGRES"] })]
        const out = filterCatalog(rows, withFilters({ engine: ["POSTGRES"] }), "curriculum")
        assert.equal(out.length, 1)
    })

    it("topics and companies are separate groups", () => {
        const rows = [
            p({ slug: "a", topicTags: ["joins"], companyTags: ["acme"] }),
            p({ slug: "b", topicTags: ["joins"] }),
        ]
        const out = filterCatalog(
            rows,
            withFilters({ topics: ["joins"], companies: ["acme"] }),
            "curriculum"
        )
        assert.deepEqual(out.map((r) => r.slug), ["a"])
    })

    it("search matches title case-insensitively or the exact number", () => {
        const rows = [
            p({ number: 247, slug: "a", title: "Second highest salary" }),
            p({ number: 119, slug: "b", title: "Duplicate emails" }),
        ]
        assert.deepEqual(
            filterCatalog(rows, withFilters({ search: "SALARY" }), "curriculum").map((r) => r.slug),
            ["a"]
        )
        assert.deepEqual(
            filterCatalog(rows, withFilters({ search: "119" }), "curriculum").map((r) => r.slug),
            ["b"]
        )
    })
})

describe("filterCatalog — sorting", () => {
    it("curriculum order sorts by module position then problem number", () => {
        const rows = [
            p({ slug: "m2", number: 5, modulePosition: 1 }),
            p({ slug: "m1b", number: 9, modulePosition: 0 }),
            p({ slug: "m1a", number: 2, modulePosition: 0 }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["m1a", "m1b", "m2"])
    })

    it("curriculum order puts problems with no module last", () => {
        const rows = [
            p({ slug: "loose", number: 1 }),
            p({ slug: "inmodule", number: 99, modulePosition: 3 }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "curriculum")
        assert.deepEqual(out.map((r) => r.slug), ["inmodule", "loose"])
    })

    it("newest sorts by createdAt descending", () => {
        const rows = [
            p({ slug: "old", createdAt: new Date(1_000) }),
            p({ slug: "new", createdAt: new Date(9_000) }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "newest")
        assert.deepEqual(out.map((r) => r.slug), ["new", "old"])
    })

    it("pass rate sorts hardest first and puts unattempted problems last", () => {
        // An unattempted problem has no rate at all. Sorting it as 0% would
        // claim it is the hardest problem in the catalog.
        const rows = [
            p({ slug: "easy", attemptCount: 10, acceptedCount: 9 }),
            p({ slug: "hard", attemptCount: 10, acceptedCount: 1 }),
            p({ slug: "untried" }),
        ]
        const out = filterCatalog(rows, EMPTY_FILTERS, "pass-rate")
        assert.deepEqual(out.map((r) => r.slug), ["hard", "easy", "untried"])
    })

    it("does not mutate the input", () => {
        const rows = [p({ slug: "b", number: 2 }), p({ slug: "a", number: 1 })]
        const before = rows.map((r) => r.slug)
        filterCatalog(rows, EMPTY_FILTERS, "newest")
        assert.deepEqual(rows.map((r) => r.slug), before)
    })
})

describe("computeFacets", () => {
    it("counts within a group ignore that group's own selection", () => {
        // THE load-bearing rule. If selecting EASY made the MEDIUM count 0,
        // the rail would tell the learner there is nothing else to pick.
        const rows = [
            p({ slug: "a", difficulty: "EASY" }),
            p({ slug: "b", difficulty: "MEDIUM" }),
            p({ slug: "c", difficulty: "MEDIUM" }),
        ]
        const facets = computeFacets(rows, withFilters({ difficulty: ["EASY"] }))
        const medium = facets.difficulty.find((f) => f.value === "MEDIUM")
        assert.equal(medium?.count, 2)
    })

    it("counts within a group DO reflect other groups' selections", () => {
        const rows = [
            p({ slug: "a", difficulty: "EASY", dialects: ["DUCKDB"] }),
            p({ slug: "b", difficulty: "MEDIUM", dialects: ["POSTGRES"] }),
        ]
        const facets = computeFacets(rows, withFilters({ engine: ["DUCKDB"] }))
        assert.equal(facets.difficulty.find((f) => f.value === "MEDIUM")?.count, 0)
        assert.equal(facets.difficulty.find((f) => f.value === "EASY")?.count, 1)
    })

    it("lists every difficulty even at zero, so options never disappear", () => {
        const facets = computeFacets([p({ difficulty: "EASY" })], EMPTY_FILTERS)
        assert.deepEqual(
            facets.difficulty.map((f) => f.value),
            ["EASY", "MEDIUM", "HARD"]
        )
    })

    it("orders topic and company facets by count descending", () => {
        const rows = [
            p({ slug: "a", topicTags: ["joins", "windows"] }),
            p({ slug: "b", topicTags: ["joins"] }),
        ]
        const facets = computeFacets(rows, EMPTY_FILTERS)
        assert.deepEqual(facets.topics.map((f) => f.value), ["joins", "windows"])
        assert.equal(facets.topics[0].count, 2)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test scripts/test-catalog-model.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/practice/catalog-model.ts`. Rules in order:

1. **`EMPTY_FILTERS`** has empty arrays and `search: ""`.
2. **A group with no selection does not filter.** Empty array means "all", not "none".
3. **Status**: `solved` = `solved`; `attempted` = `attempted && !solved`; `todo` = `!attempted && !solved`. The three partition the catalog.
4. **Difficulty / topics / companies**: membership. **Engine**: the problem matches if any selected engine is in `dialects`.
5. **Search**: trimmed, lowercased title substring, or exact `String(number)`.
6. **Sorts**: `curriculum` by `modulePosition` ascending with `null` last, then `number`; `newest` by `createdAt` descending; `pass-rate` by `acceptedCount / attemptCount` ascending (hardest first) with `attemptCount === 0` last.
7. **Never mutate the input** — copy before sorting.
8. **`computeFacets`** computes each group's counts against the problems filtered by *every other* group, so a group's own selection never suppresses its siblings. Status, difficulty and engine always list every option even at zero; topics and companies list only present tags, ordered by count descending then slug.

- [ ] **Step 4: Wire and verify**

`package.json`, after `test:problems-panel`:

```json
"test:catalog-model": "node --import tsx --test scripts/test-catalog-model.ts",
```

`.github/workflows/test.yml`, after the `Test problems panel model` step:

```yaml
      - name: Test catalog model
        run: npm run test:catalog-model
```

Run: `npm run test:catalog-model`
Expected: PASS, exit 0, 18 tests.

Run: `npx --yes js-yaml .github/workflows/test.yml > /dev/null && echo "yaml ok"`
Expected: `yaml ok`

- [ ] **Step 5: Commit**

```bash
git add lib/practice/catalog-model.ts scripts/test-catalog-model.ts package.json .github/workflows/test.yml
git commit -m "feat(practice): add the catalog facet and sort model"
```

---

### Task 3: Facet rail, toolbar and table

**Files:**
- Create: `components/practice/catalog/FacetRail.tsx`, `CatalogToolbar.tsx`, `CatalogTable.tsx`, `CatalogRow.tsx`
- Modify: `app/practice/page.tsx`
- Delete: `components/practice/PracticeList.tsx`

**Interfaces:**
- Consumes: `getCatalogProblems` (Task 1), `filterCatalog` / `computeFacets` / `CatalogFilters` / `CatalogSort` (Task 2), `formatPassRate` + `PASS_RATE_TITLE` (`lib/workspace/pass-rate.ts`, shipped in SP5).
- Produces:

```tsx
export function CatalogRow(props: {
    problem: CatalogProblem
    /** Compact drops the company and pass-rate columns; used by the module screen. */
    compact?: boolean
}): JSX.Element
```

- [ ] **Step 1: Build the pieces**

`FacetRail` (236px, on `panel`): Status / Difficulty / Engine as groups of `12px checkbox · name · count`, then Topics as mono chips, then Companies as `name · count` rows. Multi-select; clicking toggles. All state is lifted to the page.

`CatalogToolbar` (on `panel-sunken`): a mono segmented control for Curriculum order / Newest / Pass rate, and a right-aligned `Showing {filtered} of {total}`.

`CatalogRow` on `grid 34px 62px 1fr 120px 90px 78px 20px`: status icon (`CircleCheck` in `primary` solved / `CircleDashed` in `warning` attempted / `Circle` otherwise), mono number, title at 14.5px dimmed to `text-muted` when solved with mono tag chips beneath, first company tag, difficulty in its colour, `formatPassRate(...)` with `PASS_RATE_TITLE` as the `title`, chevron. **Render nothing in the pass-rate cell when `formatPassRate` returns null** — a problem nobody has attempted must not read "0% pass".

`CatalogTable`: `panel-raised` header at 10px mono uppercase, 1px `line-faint` row rules, and an `EmptyState` when the filtered list is empty.

- [ ] **Step 2: Carry the inventory across**

Three behaviours live in `PracticeList` and appear in no design screen. They move into the new page, not into the bin:

- the DuckDB-WASM + PGlite prefetch on mount, which warms the SQL engine before a learner opens a problem;
- the `/` shortcut focusing search;
- tag-pill overflow (`MOBILE_TAG_LIMIT`) on narrow screens.

- [ ] **Step 3: Rebuild the page**

`app/practice/page.tsx` becomes a server component that calls `getCatalogProblems(session?.user?.id ?? null, isStaff)` and hands the rows to a client component owning `filters` and `sort`. Header: mono "CATALOG", h1, description, and three right-aligned stats — Solved in `primary`, Attempted, and "% of catalog" in `warning`.

- [ ] **Step 4: Verify**

Run: `npm run check:theme-utilities && npm run check:token-parity`
Expected: both exit 0. The first will name any class whose token was never mapped in `@theme inline` — fix by using a mapped token, not by inventing one.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/practice/catalog app/practice/page.tsx
git rm components/practice/PracticeList.tsx
git commit -m "feat(practice): rebuild the catalog with a facet rail and sortable table"
```

---

### Task 4: Catalog e2e

**Files:**
- Create: `tests/e2e/practice-catalog.spec.ts`

**Interfaces:**
- Consumes: the page from Task 3.
- Produces: the regression suite phases 3 and 4 build on.

- [ ] **Step 1: Write the tests**

```ts
import { test, expect } from "@playwright/test"

test.describe("practice catalog", () => {
    test("filtering by difficulty narrows the table and updates the count", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice")
        const showing = page.getByText(/Showing \d+ of \d+/)
        const before = await showing.innerText()

        await page.getByRole("checkbox", { name: /easy/i }).click()
        await expect(showing).not.toHaveText(before)
    })

    test("a facet's siblings keep non-zero counts after selecting it", async ({
        page,
    }) => {
        // The rail must not tell the learner there is nothing else to pick.
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice")
        await page.getByRole("checkbox", { name: /easy/i }).click()
        const medium = page.getByRole("checkbox", { name: /medium/i })
        await expect(medium).toBeVisible()
        const label = await medium.locator("xpath=..").innerText()
        expect(label).not.toMatch(/\b0\b/)
    })

    test("sorting by newest reorders the first row", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice")
        const first = page.getByRole("row").nth(1)
        const before = await first.innerText()
        await page.getByRole("button", { name: /newest/i }).click()
        await expect(first).not.toHaveText(before)
    })

    test("the / shortcut focuses search", async ({ page }) => {
        await page.goto("/practice")
        await page.keyboard.press("/")
        await expect(page.getByRole("searchbox")).toBeFocused()
    })
})
```

- [ ] **Step 2: Run**

Run: `npm run build` then `lsof -ti :3100 | xargs -r kill -9` then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- practice-catalog`
Expected: 4 pass. Playwright already runs the whole directory under `test:e2e`, so no workflow line is needed.

- [ ] **Step 3: Commit and open the phase 2 PR**

```bash
git add tests/e2e/practice-catalog.spec.ts
git commit -m "test(practice): cover catalog facets, sorting and the search shortcut"
gh pr create --base main --title "feat(practice): rebuild the catalog with facets, sorting and pass rate"
```

> Touches `.github/workflows/test.yml` (Task 2), so this PR needs a **web-UI merge**.

---

## Phase 3 — Module screen

PR title: `feat(learn): add the module screen`

### File Structure

- Create: `lib/learn/module-model.ts` — resume, lesson state, facts. Pure.
- Create: `scripts/test-module-model.ts`
- Create: `app/learn/tracks/[slug]/modules/[moduleSlug]/page.tsx`
- Create: `components/learn/module/ModuleHeader.tsx`, `LessonRow.tsx`, `ModuleRail.tsx`
- Modify: `scripts/test-console-nav.ts` — the module URL in the exclusivity fixture

---

### Task 5: The module model

**Files:**
- Create: `lib/learn/module-model.ts`
- Test: `scripts/test-module-model.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Consumes: `CurriculumModule`, `CurriculumLesson` from `lib/curriculum-read.ts`:

```ts
type CurriculumLesson = {
    articleId: string
    slug: string
    title: string
    readingMinutes: number | null
    completed: boolean
    checkpoints: CurriculumCheckpoint[]
}
type CurriculumModule = {
    id: string; slug: string; name: string; description: string
    position: number; unlocked: boolean
    lessons: CurriculumLesson[]
    rollup: ModuleRollup
}
```

- Produces:

```ts
export type LessonState = "done" | "in-progress" | "todo"

export function lessonState(
    lesson: CurriculumLesson,
    isResumeTarget: boolean
): LessonState

export function resumeLesson(module: CurriculumModule): CurriculumLesson | null

export type ModuleFacts = { readingMinutes: number; problemCount: number }
export function moduleFacts(module: CurriculumModule): ModuleFacts
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-module-model.ts`:

```ts
// Unit tests for the module screen's pure logic. No DOM, no database.
//
// Run: node --import tsx --test scripts/test-module-model.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    lessonState,
    moduleFacts,
    resumeLesson,
} from "../lib/learn/module-model"
import type {
    CurriculumLesson,
    CurriculumModule,
} from "../lib/curriculum-read"

function lesson(over: Partial<CurriculumLesson>): CurriculumLesson {
    return {
        articleId: "a",
        slug: "l",
        title: "L",
        readingMinutes: 5,
        completed: false,
        checkpoints: [],
        ...over,
    }
}

function mod(lessons: CurriculumLesson[]): CurriculumModule {
    return {
        id: "m",
        slug: "m",
        name: "Module",
        description: "",
        position: 0,
        unlocked: true,
        lessons,
        rollup: {
            moduleId: "m",
            lessonsDone: lessons.filter((l) => l.completed).length,
            lessonsTotal: lessons.length,
            problemsDone: 0,
            problemsTotal: 0,
            percent: 0,
        },
    }
}

describe("resumeLesson", () => {
    it("points at the first incomplete lesson", () => {
        const m = mod([
            lesson({ slug: "one", completed: true }),
            lesson({ slug: "two" }),
            lesson({ slug: "three" }),
        ])
        assert.equal(resumeLesson(m)?.slug, "two")
    })

    it("points at the first lesson when nothing is started", () => {
        const m = mod([lesson({ slug: "one" }), lesson({ slug: "two" })])
        assert.equal(resumeLesson(m)?.slug, "one")
    })

    it("falls back to the first lesson when the module is complete", () => {
        // "Resume" on a finished module should re-read it, not vanish.
        const m = mod([
            lesson({ slug: "one", completed: true }),
            lesson({ slug: "two", completed: true }),
        ])
        assert.equal(resumeLesson(m)?.slug, "one")
    })

    it("returns null for a module with no lessons", () => {
        assert.equal(resumeLesson(mod([])), null)
    })

    it("ignores a completed lesson that follows an incomplete one", () => {
        const m = mod([
            lesson({ slug: "one" }),
            lesson({ slug: "two", completed: true }),
        ])
        assert.equal(resumeLesson(m)?.slug, "one")
    })
})

describe("lessonState", () => {
    it("is done when completed, even if it is the resume target", () => {
        assert.equal(lessonState(lesson({ completed: true }), true), "done")
    })

    it("is in-progress for the resume target", () => {
        assert.equal(lessonState(lesson({}), true), "in-progress")
    })

    it("is todo otherwise", () => {
        assert.equal(lessonState(lesson({}), false), "todo")
    })
})

describe("moduleFacts", () => {
    it("sums reading minutes across lessons", () => {
        const m = mod([
            lesson({ readingMinutes: 5 }),
            lesson({ readingMinutes: 7 }),
        ])
        assert.equal(moduleFacts(m).readingMinutes, 12)
    })

    it("treats a null readingMinutes as zero rather than NaN", () => {
        const m = mod([
            lesson({ readingMinutes: null }),
            lesson({ readingMinutes: 4 }),
        ])
        assert.equal(moduleFacts(m).readingMinutes, 4)
    })

    it("counts checkpoints across every lesson", () => {
        const cp = {
            problemId: "p",
            number: 1,
            slug: "s",
            title: "T",
            difficulty: "EASY" as const,
            solved: false,
        }
        const m = mod([
            lesson({ checkpoints: [cp, cp] }),
            lesson({ checkpoints: [cp] }),
        ])
        assert.equal(moduleFacts(m).problemCount, 3)
    })

    it("is zero for an empty module rather than throwing", () => {
        assert.deepEqual(moduleFacts(mod([])), {
            readingMinutes: 0,
            problemCount: 0,
        })
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test scripts/test-module-model.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/learn/module-model.ts`. `resumeLesson` returns the first lesson with `completed === false`, or `lessons[0]` when all are complete, or `null` when there are none. `lessonState` returns `done` when `completed`, else `in-progress` when it is the resume target, else `todo`. `moduleFacts` sums `readingMinutes ?? 0` and counts checkpoints across lessons.

- [ ] **Step 4: Wire and verify**

`package.json`: `"test:module-model": "node --import tsx --test scripts/test-module-model.ts",`

`.github/workflows/test.yml`, after `Test catalog model`:

```yaml
      - name: Test module model
        run: npm run test:module-model
```

Run: `npm run test:module-model`
Expected: PASS, exit 0, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/learn/module-model.ts scripts/test-module-model.ts package.json .github/workflows/test.yml
git commit -m "feat(learn): add the module screen's resume and facts model"
```

---

### Task 6: The route and the predicate test

**Files:**
- Create: `app/learn/tracks/[slug]/modules/[moduleSlug]/page.tsx`
- Create: `components/learn/module/ModuleHeader.tsx`, `LessonRow.tsx`, `ModuleRail.tsx`
- Modify: `scripts/test-console-nav.ts`

**Interfaces:**
- Consumes: `getTrackCurriculumForUser`, `module-model` (Task 5), `CatalogRow` with `compact` (Task 3), `modulePrefix` from `components/learn/reader/lesson-nav.ts`.
- Produces: the route `/learn/tracks/<track>/modules/<module>`.

- [ ] **Step 1: Write the failing predicate test**

The module URL is 5 segments, so neither predicate may claim it. Add to the existing `shell modes are mutually exclusive` describe in `scripts/test-console-nav.ts`:

```ts
    it("the module screen is a normal shell route", () => {
        // 5 segments: isFocusRoute needs exactly 4, isAppRoute exactly 2.
        // The 4-segment sibling /learn/tracks/<track>/modules WOULD match
        // isFocusRoute, which is why no module index route exists.
        const url = "/learn/tracks/analyst-interview-prep/modules/04-window-functions"
        assert.equal(isFocusRoute(url), false)
        assert.equal(isAppRoute(url), false)
        assert.equal(isFocusRoute("/learn/tracks/analyst-interview-prep/modules"), true)
    })
```

- [ ] **Step 2: Run**

Run: `npm run test:console-nav`
Expected: PASS immediately — this asserts existing behaviour rather than driving new code. That is the point: it pins the invariant the route shape depends on, including the documented reason the 4-segment sibling is absent.

- [ ] **Step 3: Build the route**

`page.tsx` is a server component: resolve the session, compute `isStaff` (`ADMIN` or `MODERATOR`), call `getTrackCurriculumForUser(slug, userId, { allowDraft: isStaff })`, find the module by `moduleSlug`, and `notFound()` when either is missing.

Layout per the spec: a mono breadcrumb bar on `panel-sunken` with `<track-slug> / <module-slug>` and `Module {position + 1} of {total}` right-aligned in `primary`; then `1fr 340px`. Left: h1, description, a `primary` "Resume lesson {n}" linking to `/learn/tracks/<track>/<lessonSlug>`, the rollup bar, `LessonRow`s, then attached problems using `CatalogRow` with `compact`. Right: Prerequisites (earlier modules, checked when `rollup.percent === 100`) and Module facts from `moduleFacts`.

**The locked state is a chip and nothing else.** Render "Locked until {prefix}" on the header when `unlocked === false`, and still render every lesson as a working link. `isModuleUnlocked` must never gate the route.

- [ ] **Step 4: Verify**

Run: `npm run test:console-nav && npm run check:theme-utilities && npm run build`
Expected: all exit 0.

Then look at it, because a build proves nothing about layout:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev
# visit /learn/tracks/analyst-interview-prep/modules/<a real module slug>
```
Get a real slug with:
```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsx -e "
import {prisma} from './lib/prisma'
prisma.module.findMany({select:{slug:true,position:true}}).then(r=>{console.log(r);process.exit(0)})"
```

- [ ] **Step 5: Commit**

```bash
git add app/learn components/learn/module scripts/test-console-nav.ts
git commit -m "feat(learn): add the module screen"
```

---

### Task 7: Module e2e

**Files:**
- Create: `tests/e2e/module.spec.ts`

- [ ] **Step 1: Write the tests**

```ts
import { test, expect } from "@playwright/test"
import { prisma } from "./fixtures/db"

test.describe("module screen", () => {
    test("renders lessons and keeps the console shell", async ({ page }) => {
        const module = await prisma.module.findFirst({
            select: { slug: true, track: { select: { slug: true } } },
        })
        if (!module) throw new Error("no module seeded")

        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/learn/tracks/${module.track.slug}/modules/${module.slug}`)

        // Normal shell route: footer present, exactly one banner.
        await expect(page.getByRole("contentinfo")).toHaveCount(1)
        await expect(page.getByRole("banner")).toHaveCount(1)
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    })

    test("an unknown module slug renders not-found", async ({ page }) => {
        const track = await prisma.track.findFirst({ select: { slug: true } })
        if (!track) throw new Error("no track seeded")
        // notFound() returns HTTP 200 app-wide — Next commits the status
        // before the throw — so assert the body, never the status code.
        await page.goto(`/learn/tracks/${track.slug}/modules/does-not-exist`)
        await expect(page.getByText(/not found/i).first()).toBeVisible()
    })
})
```

- [ ] **Step 2: Run**

Run: `npm run build` then `lsof -ti :3100 | xargs -r kill -9` then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- module`
Expected: 2 pass.

> If the track is DRAFT locally the page 404s for a signed-out visitor. Either publish it locally first (`prisma.track.update`) or sign the test in as an ADMIN using `seedUser` + `sessionCookie`, as `tests/e2e/workspace.spec.ts` does.

- [ ] **Step 3: Commit and open the phase 3 PR**

```bash
git add tests/e2e/module.spec.ts
git commit -m "test(learn): cover the module route and its not-found path"
gh pr create --base main --title "feat(learn): add the module screen"
```

> Touches `.github/workflows/test.yml` (Task 5) — **web-UI merge**.

---

## Phase 4 — Tracks index and detail

PR title: `feat(learn): rebuild the tracks index and detail`

### File Structure

- Create: `lib/learn/tracks-read.ts` — `getTrackSummariesForUser`
- Create: `components/learn/tracks/TrackSummaryCard.tsx`, `ModuleRow.tsx`, `TrackProgressCard.tsx`, `RulesOfThePath.tsx`
- Modify: `app/learn/tracks/page.tsx`, `app/learn/tracks/[slug]/page.tsx`

---

### Task 8: The summaries read

**Files:**
- Create: `lib/learn/tracks-read.ts`

**Interfaces:**
- Consumes: `rollUpModule`, `rollUpTrack` from `lib/curriculum-progress.ts`.
- Produces:

```ts
export type TrackSummary = {
    slug: string
    name: string
    summary: string
    difficulty: string
    estimatedMinutes: number
    lessonsTotal: number
    problemsTotal: number
    rollup: TrackRollup
    /** Lesson to resume: first incomplete across modules in order, or null. */
    resume: { moduleSlug: string; lessonSlug: string } | null
}

export const getTrackSummariesForUser: (
    userId: string | null,
    allowDraft?: boolean
) => Promise<TrackSummary[]>
```

- [ ] **Step 1: Implement with a bounded query count**

Three queries regardless of track count, then roll up in memory:

1. published tracks (plus DRAFT when `allowDraft`) with `modules → lessons → article` and `checkpoints → problem`;
2. the viewer's completed `LessonProgress` article ids;
3. the viewer's `ACCEPTED` submission problem ids, `distinct`.

Then reuse `rollUpModule` per module and `rollUpTrack` per track. Not a `"use server"` module — it takes an explicit `userId`.

- [ ] **Step 2: Verify the query count is actually three**

A claim like this is worth proving, not assuming:

```bash
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsx -e "
import {PrismaClient} from '@prisma/client'
const p = new PrismaClient({log:[{emit:'event',level:'query'}]})
let n = 0; p.\$on('query', () => { n++ })
import('./lib/learn/tracks-read').then(async ({getTrackSummariesForUser}) => {
  const rows = await getTrackSummariesForUser(null, true)
  console.log('tracks', rows.length, 'queries', n)
  console.log(JSON.stringify(rows[0], null, 1))
  process.exit(0)
})"
```
Expected: `queries 3` (or fewer when there is no user), and a populated rollup.

- [ ] **Step 3: Commit**

```bash
git add lib/learn/tracks-read.ts
git commit -m "feat(learn): add a bounded per-user track summaries read"
```

---

### Task 9: Tracks index

**Files:**
- Modify: `app/learn/tracks/page.tsx`
- Create: `components/learn/tracks/TrackSummaryCard.tsx`

- [ ] **Step 1: Build the card**

`grid 36px 1fr`: a mono number chip, title at 16px/600, description, a mono `{lessonsTotal} lessons · {problemsTotal} problems · {hrs} hrs` line, and a progress row of `bar · percentage · Resume →` linking to the resume target.

**No kind chip and no All / Career / Skill filter** — `Track` has no `kind` field and SP4 adds no migrations. Do not add a placeholder chip.

- [ ] **Step 2: Rebuild the page**

Two-column grid, 8px gap. Server component calling `getTrackSummariesForUser`. Keep the existing empty state.

- [ ] **Step 3: Verify**

Run: `npm run check:theme-utilities && npm run build`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- tracks`
Expected: exit 0 and the existing 4 `tracks.spec.ts` tests still pass — they assert the index lists published tracks and hides drafts.

- [ ] **Step 4: Commit**

```bash
git add app/learn/tracks/page.tsx components/learn/tracks
git commit -m "feat(learn): rebuild the tracks index with progress and resume"
```

---

### Task 10: Track detail, with the TrackItem fallback

**Files:**
- Modify: `app/learn/tracks/[slug]/page.tsx`
- Create: `components/learn/tracks/ModuleRow.tsx`, `TrackProgressCard.tsx`, `RulesOfThePath.tsx`

- [ ] **Step 1: Replace the SP3 stopgap**

Delete the interim module list and its comment. Render `ModuleRow`s on `grid 34px 1fr 110px 130px 90px` — number chip, name + description, counts, bar + percentage, state — each linking to the module route from Task 6.

- [ ] **Step 2: Keep the study sequence as a fallback**

```tsx
{curriculum && curriculum.modules.length > 0 ? (
    <ModuleList modules={curriculum.modules} trackSlug={slug} />
) : (
    // TrackItem predates SP1's spine and has 0 rows locally, but it has a
    // full admin + MCP authoring surface and production still runs the old
    // tracks feature. A track authored under the old model must not render
    // an empty page after the release.
    <StudySequence items={track.items} progress={progress} />
)}
```

Keep `TrackItemRow` exactly as it is. `tests/e2e/tracks.spec.ts` seeds `TrackItem` rows and asserts them, so this branch is already covered.

- [ ] **Step 3: Build the rail**

`TrackProgressCard`: `primary`-bordered, percentage, 5px bar, `lessons / problems / est. remaining`, and a "Continue module {n}" button. Est. remaining is the remaining lessons' `readingMinutes`.

`RulesOfThePath`: static copy, four lines — a module unlocks when the previous one completes; lessons auto-complete on read; problems complete on an accepted submission; **skipping ahead is always allowed**. The last line is the user-facing statement of the advisory-unlock rule, so keep its wording unambiguous.

- [ ] **Step 4: Verify**

Run: `npm run build`, then
`DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e -- tracks module`
Expected: all pass — `tracks.spec.ts` exercises the fallback branch, `module.spec.ts` the new links.

- [ ] **Step 5: Commit**

```bash
git add "app/learn/tracks/[slug]/page.tsx" components/learn/tracks
git commit -m "feat(learn): rebuild the track detail on modules, keeping the study-sequence fallback"
```

---

### Task 11: Capability inventory walk and the phase 4 PR

**Files:**
- Modify: this plan — tick the inventory table

- [ ] **Step 1: Walk the table by hand**

Start the dev server and exercise **every** row of the capability inventory at the top of this plan. The prefetch and the `/` shortcut are the two nothing automated covers end to end; the tag routes are out of scope but must still load.

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev`

For the prefetch, confirm in DevTools' Network tab that the DuckDB WASM request begins on `/practice` **before** any problem is opened. This is the item most likely to be lost, because nothing on screen shows it.

- [ ] **Step 2: Full verification**

```bash
npm run test:console-nav && npm run test:catalog-model && npm run test:module-model \
  && npm run test:problems-panel && npm run test:pass-rate && npm run test:approach-sort \
  && npm run test:lesson-nav && npm run test:reading-progress && npm run test:scroll-restoration \
  && npm run check:token-parity && npm run check:theme-utilities \
  && npx tsc --noEmit && npm run build
lsof -ti :3100 | xargs -r kill -9
DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:e2e
```
Expected: exit 0 throughout. Report actual counts, not "all green". `tests/e2e/learn-csp.spec.ts` fails locally and passes in CI — that one is environmental.

- [ ] **Step 3: Open the phase 4 PR**

```bash
gh pr create --base main --title "feat(learn): rebuild the tracks index and detail"
```

The body must state which inventory rows were verified by hand, and that **SP6 is unblocked**.

---

## Done means

- Four PRs merged to `main`, each with `--base main`.
- Two new suites in `.github/workflows/test.yml`: `test:catalog-model`, `test:module-model`.
- Every capability-inventory row verified by hand at the end of phase 4.
- `docs/ROADMAP.md` gains an SP4 entry.
- The two open questions from the spec — URL-synced catalog filters, and the out-of-scope Learn hub — either resolved or carried into the SP4 handoff.
