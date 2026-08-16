# SP7 Admin Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the admin surface onto the Console system — replace the stacked learner-sidebar-plus-`AdminNav` arrangement with a single grouped admin sidebar, and rebuild the Overview, Problems list and Problem form.

**Architecture:** `ConsoleChrome` already wraps `/admin` as a normal shell route; it gains one branch that renders an admin nav model instead of the learner one. All decision logic lives in Prisma-free, DOM-free modules under `lib/admin/` so it unit-tests without a database. No schema changes.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7, Tailwind v4 with HSL CSS-variable tokens, Lucide icons, `node --import tsx --test` for unit suites, Playwright for e2e.

## Global Constraints

- **Zero migrations.** Every data dependency resolves against existing schema, or the block is omitted.
- `ConsoleChrome` owns `#app-scroll`, `<main id="main-content">` and `<Footer>`. No competing scroll container. No `<header>` inside `<main>` — ARIA forbids `banner` there.
- **Exactly three shell modes.** Admin stays a **normal** route. `isFocusRoute` and `isAppRoute` must remain provably disjoint; `scripts/test-console-nav.ts`'s mutual-exclusivity assertion must stay green.
- **Semantic colour tokens only.** No hex, no `slate-*`/`blue-*`. `--accent-violet` already exists in both themes — dark `#A78BFA` (`app/globals.css:55`), light `#6D28D9` (`:160`) — and `--accent` aliases it. **Use it; do not add tokens.**
- **No emoji icons.** Lucide SVG only.
- No `lib/` file imports from `actions/`. `actions/` imports `lib/`, never the reverse.
- No `"use server"` module exports a function taking a caller-supplied `userId`.
- Positions move only inside their dedicated reorder transactions (`reorderCheckpoints` et al). Never write `position` directly.
- `lib/admin-validation.ts` stays **Prisma-free** — the MCP server bundles it via tsup.
- **The fallback rule:** a block that would render empty must show an honest alternative or not render at all.
- Every new test suite is wired into `.github/workflows/test.yml` **in the same PR that adds it**.
- **CI seeds no curriculum data.** Tests touching tracks/modules/lessons create their own fixtures and clean up. Never mutate ambient rows; if an assertion needs their absence, detect-and-skip locally but **fail when `process.env.CI` is set**.
- `npm run build` keeps `--webpack`.
- **Never pass a bare `new Date()` into a unit test.** Delta functions take an explicit `now`.

## File Structure

| File | Responsibility |
|---|---|
| `lib/admin/admin-nav-model.ts` | Groups, items, badge keys, role filtering. Pure. |
| `lib/admin/metric-delta.ts` | Delta computation and the rule for when there is no delta. Pure. |
| `lib/admin/problems-filter.ts` | Search + status filtering over a loaded list. Pure. |
| `lib/admin/form-tabs.ts` | Maps field-level errors to tab identities. Pure. |
| `components/layout/console/ConsoleAdminSidebar.tsx` | Renders the admin nav model. Server component. |
| `components/admin/AdminQuickActions.tsx` | Breadcrumb quick-action bar with wired shortcuts. |
| `components/admin/MetricCard.tsx` | Gains an optional delta line. |
| `components/admin/QueueStack.tsx` | The three queue cards. |
| `components/admin/ProblemsListClient.tsx` | Search + filter over the loaded rows. |
| `components/admin/problem-form/*` | The five tabs and the validation checklist. |

---

## Phase 1 — The admin shell

### Task 1: The admin nav model

**Files:**
- Create: `lib/admin/admin-nav-model.ts`
- Test: `scripts/test-admin-nav.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export type AdminBadgeKey = "openReports" | "articleQueue" | "discussionQueue"

export interface AdminNavItem {
    key: string
    label: string
    icon: LucideIcon
    href: string
    match?: "exact" | "prefix"     // defaults to "prefix"
    badgeKey?: AdminBadgeKey
    adminOnly: boolean
    requiresDiscussionQueuePermission?: boolean
}

export interface AdminNavGroup {
    /** null for the ungrouped leading items. */
    label: string | null
    items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[]

export interface AdminNavViewer {
    role: "ADMIN" | "MODERATOR"
    canViewDiscussionQueue: boolean
}

/** Groups the viewer may see. A group whose items all filter out is dropped
 *  entirely — never rendered as an empty heading. */
export function visibleAdminNav(viewer: AdminNavViewer): AdminNavGroup[]

/** Active item key for a pathname, or null. Longest prefix wins. */
export function activeAdminNavKey(pathname: string): string | null
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-admin-nav.ts`:

```ts
// Unit tests for the admin sidebar's nav model.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-admin-nav.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    ADMIN_NAV,
    visibleAdminNav,
    activeAdminNavKey,
} from "../lib/admin/admin-nav-model"

const ADMIN = { role: "ADMIN" as const, canViewDiscussionQueue: true }
const MOD_WITH = { role: "MODERATOR" as const, canViewDiscussionQueue: true }
const MOD_WITHOUT = { role: "MODERATOR" as const, canViewDiscussionQueue: false }

function allItems(groups: ReturnType<typeof visibleAdminNav>) {
    return groups.flatMap((g) => g.items)
}

describe("ADMIN_NAV shape", () => {
    it("carries all fourteen destinations", () => {
        assert.equal(allItems(ADMIN_NAV).length, 14)
    })

    it("uses the five designed groups in order", () => {
        assert.deepEqual(
            ADMIN_NAV.map((g) => g.label),
            [null, "Content", "Scheduling", "Moderation", "People & access"]
        )
    })

    it("gives every item a real href", () => {
        for (const item of allItems(ADMIN_NAV)) {
            assert.ok(item.href.startsWith("/admin"), `${item.key} href`)
        }
    })

    it("has unique keys", () => {
        const keys = allItems(ADMIN_NAV).map((i) => i.key)
        assert.equal(new Set(keys).size, keys.length)
    })
})

describe("visibleAdminNav", () => {
    it("shows everything to an admin", () => {
        assert.equal(allItems(visibleAdminNav(ADMIN)).length, 14)
    })

    it("shows a permitted moderator only the discussion queue", () => {
        const items = allItems(visibleAdminNav(MOD_WITH))
        assert.deepEqual(items.map((i) => i.key), ["discussions"])
    })

    it("shows an unpermitted moderator nothing", () => {
        assert.deepEqual(visibleAdminNav(MOD_WITHOUT), [])
    })

    it("drops a group whose items all filter out, rather than emptying it", () => {
        for (const group of visibleAdminNav(MOD_WITH)) {
            assert.ok(group.items.length > 0, `${group.label} left empty`)
        }
    })
})

describe("activeAdminNavKey", () => {
    it("matches Overview exactly, not by prefix", () => {
        assert.equal(activeAdminNavKey("/admin"), "overview")
        assert.equal(activeAdminNavKey("/admin/problems"), "problems")
    })

    it("matches nested routes by prefix", () => {
        assert.equal(activeAdminNavKey("/admin/problems/foo/edit"), "problems")
        assert.equal(activeAdminNavKey("/admin/tracks/x/edit"), "tracks")
    })

    it("returns null off the admin surface", () => {
        assert.equal(activeAdminNavKey("/practice"), null)
    })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --import tsx --test scripts/test-admin-nav.ts`
Expected: FAIL — cannot resolve `../lib/admin/admin-nav-model`.

- [ ] **Step 3: Implement the model**

Create `lib/admin/admin-nav-model.ts`. Icons are the same Lucide set `components/admin/AdminNav.tsx` uses today — carry them over unchanged so the sidebar reads identically.

Groups, in order: ungrouped `Overview`; **Content** — Problems, Schemas, Topics, Tracks, Articles, Tags; **Scheduling** — Daily, Contests; **Moderation** — Reports, Discussions; **People & access** — Moderators, Contributors, API keys.

Badge keys, matching today's `AdminNav`: `articles → articleQueue`, `reports → openReports`, `discussions → discussionQueue`. Every item is `adminOnly: true` except `discussions`, which is `requiresDiscussionQueuePermission: true`.

`visibleAdminNav` mirrors the existing filter (`components/admin/AdminNav.tsx:100-104`): an ADMIN sees everything; a MODERATOR sees only items with `requiresDiscussionQueuePermission` when `canViewDiscussionQueue`. Then drop any group left with no items — an empty group heading is exactly the kind of empty block the fallback rule forbids.

`activeAdminNavKey` selects the longest matching `href`, honouring `match: "exact"` for Overview so `/admin/problems` does not light up `/admin`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test scripts/test-admin-nav.ts`
Expected: PASS, exit 0. **Judge by exit code** — CI runs Node 20 and prints `# pass`, local Node prints `ℹ pass`.

- [ ] **Step 5: Wire the suite into CI**

Add to `package.json` scripts:

```json
"test:admin-nav": "node --import tsx --test scripts/test-admin-nav.ts",
```

Add a step to `.github/workflows/test.yml` beside the other model suites:

```yaml
      - name: Admin nav model
        run: npm run test:admin-nav
```

- [ ] **Step 6: Commit**

```bash
git add lib/admin/admin-nav-model.ts scripts/test-admin-nav.ts package.json .github/workflows/test.yml
git commit -m "feat(admin): add the grouped admin nav model"
```

---

### Task 2: Render the admin sidebar

**Files:**
- Create: `components/layout/console/ConsoleAdminSidebar.tsx`
- Modify: `components/layout/console/ConsoleChrome.tsx`, `components/layout/console/ConsoleShell.tsx`, `app/admin/layout.tsx`
- Delete: `components/admin/AdminNav.tsx`

**Interfaces:**
- Consumes: `visibleAdminNav`, `activeAdminNavKey`, `AdminNavViewer` (Task 1).
- Produces: an admin sidebar rendered by the existing shell. No new exported API.

**Read before starting:** `components/layout/console/ConsoleChrome.tsx` in full, and `app/admin/layout.tsx`. Note that `ConsoleShell` wraps every route from `app/layout.tsx:87`, and `/admin/*` matches neither focus predicate — so admin is **already** a normal shell route and currently renders the learner sidebar with `AdminNav` stacked inside it. **This task is a swap, not an addition.**

- [ ] **Step 1: Build the sidebar**

Create `components/layout/console/ConsoleAdminSidebar.tsx` as a **server component** — it must not be a client component, so the item list never ships in the browser bundle.

It takes the viewer and the three badge counts, calls `visibleAdminNav`, and renders the same 236px sidebar shape as `ConsoleSidebar`: a header with a violet `ShieldCheck` mark, "Admin", and a role chip reading `Owner` for ADMIN or `Moderator` for MODERATOR; the grouped items with their Lucide icons and violet badge pills; and a footer link "Back to the site" pointing at `/`.

Use `text-accent` / `bg-accent/15` for the violet treatment — `--accent` already aliases `--accent-violet` in both themes. **Do not hardcode `#A78BFA`.**

- [ ] **Step 2: Branch the shell**

`ConsoleChrome` already computes `focus` and `app` from the pathname (`ConsoleChrome.tsx:49-51`). Add the admin branch alongside them:

```tsx
    const pathname = usePathname()
    const focus = isFocusRoute(pathname)
    const app = isAppRoute(pathname)
    // Admin is NOT a fourth shell mode. It is a normal route that swaps which
    // nav the existing sidebar renders, so isFocusRoute/isAppRoute — and the
    // test asserting they are disjoint — are untouched.
    const admin = pathname.startsWith("/admin")
```

Then, where the sidebar is rendered inside the `{!focus && (…)}` block, choose between the two:

```tsx
    {admin ? adminSidebarSlot : <ConsoleSidebar … />}
```

`adminSidebarSlot` is a new `React.ReactNode` prop on `ConsoleChromeProps`, passed down from `ConsoleShell` exactly as `headerSlot` and `footerSlot` already are. Threading it as a slot rather than importing the component keeps `ConsoleAdminSidebar` a server component — importing it directly into this client component would drag the whole nav list into the browser bundle, which is what Step 1 avoids.

Do **not** add a predicate to `focus-route.ts`. Do **not** introduce a fourth mode.

- [ ] **Step 3: Feed it from the layout**

`app/admin/layout.tsx` keeps its auth check and its badge-count queries exactly as they are today — including the ADMIN-vs-MODERATOR asymmetry, where a moderator gets only `discussionQueueCount`. Replace the `<AdminNav …>` render with passing those values into the shell's admin sidebar slot.

The layout's returned tree becomes just `{children}` — the shell already provides the frame.

- [ ] **Step 4: Delete AdminNav**

```bash
rm components/admin/AdminNav.tsx
grep -rn "AdminNav" app components lib scripts tests
```

Expected: no remaining imports. If anything else references it, stop and report rather than deleting.

- [ ] **Step 5: Verify**

```bash
npm run test:admin-nav
npm run test:console-nav
npm run test:scroll-restoration
npm run check:token-parity
npm run check:theme-utilities
npx tsc --noEmit
npm run build
```

Expected: all exit 0. **`test:console-nav`'s mutual-exclusivity assertion must still pass** — if it fails you have added a fourth shell mode, which this plan forbids.

- [ ] **Step 6: Commit**

```bash
git add -u && git add components/layout/console/ConsoleAdminSidebar.tsx
git commit -m "feat(admin): replace the stacked admin nav with a grouped sidebar"
```

---

### Task 3: Admin shell e2e

**Files:**
- Create: `tests/e2e/admin-shell.spec.ts`

Follow `tests/e2e/home-signed-in.spec.ts` for `seedUser`/`sessionCookie` and the prefix-and-cleanup pattern.

- [ ] **Step 1: Write the tests**

Cover:
1. An ADMIN at `/admin` sees the grouped sidebar — assert on a group heading ("Content") and on a link ("Problems") — and does **not** see the old horizontal row.
2. **A MODERATOR with discussion permission receives no admin-only links in the rendered HTML.** Assert absence of "Problems", "API keys" and "Moderators", and presence of "Discussions". This is the security-relevant case.
3. Badge counts render when non-zero.

- [ ] **Step 2: Prove the tests are not vacuous**

Break each claim and confirm failure:
- For test 2, temporarily make `visibleAdminNav` return `ADMIN_NAV` unfiltered; confirm the moderator test fails. Revert.

Report exactly what you broke and what happened, then confirm `git diff` on non-test files is empty.

- [ ] **Step 3: Run, verify CI wiring, commit**

```bash
npm run build
npx playwright test --list | grep admin-shell   # confirm auto-discovery
npm run test:e2e -- admin-shell
```

Playwright already discovers `tests/e2e`, so **no workflow change should be needed** — verify with `--list` rather than assuming, and say which is true in your report.

```bash
git add tests/e2e/admin-shell.spec.ts
git commit -m "test(admin): cover the admin shell and its role filtering"
gh pr create --base main --title "feat(admin): SP7 phase 1 — the admin shell"
```

---

## Phase 2 — Overview

### Task 4: Metric deltas

**Files:**
- Create: `lib/admin/metric-delta.ts`
- Test: `scripts/test-metric-delta.ts`
- Modify: `actions/admin-dashboard.ts`, `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Produces:

```ts
export type DeltaDirection = "up" | "down" | "flat"

export interface MetricDelta {
    /** Signed change against the previous period. */
    change: number
    direction: DeltaDirection
}

/** Returns null when a delta would be dishonest — the caller renders no
 *  delta line at all in that case, not a zero and not a dash. */
export function computeDelta(
    current: number,
    previous: number | null
): MetricDelta | null
```

`previous: null` means "this metric has no historical basis" and must yield `null`.

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-metric-delta.ts`:

```ts
// Unit tests for admin metric deltas.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-metric-delta.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { computeDelta } from "../lib/admin/metric-delta"

describe("computeDelta", () => {
    it("reports growth", () => {
        assert.deepEqual(computeDelta(12, 8), { change: 4, direction: "up" })
    })

    it("reports regression", () => {
        assert.deepEqual(computeDelta(8, 12), { change: -4, direction: "down" })
    })

    it("reports no movement as flat, not as absent", () => {
        assert.deepEqual(computeDelta(5, 5), { change: 0, direction: "flat" })
    })

    it("returns null when there is no historical basis", () => {
        assert.equal(computeDelta(5, null), null)
    })

    it("treats a zero previous period as real, not missing", () => {
        assert.deepEqual(computeDelta(3, 0), { change: 3, direction: "up" })
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --import tsx --test scripts/test-metric-delta.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `lib/admin/metric-delta.ts`. `previous === null` returns `null`; otherwise `change = current - previous` and direction follows its sign.

Note the distinction the fourth and fifth tests draw: **a previous value of `0` is data** (growth from nothing), while `null` is *absence* of data. Conflating them would print a fabricated delta.

- [ ] **Step 4: Run to verify passing**

Run: `node --import tsx --test scripts/test-metric-delta.ts` — exit 0.

- [ ] **Step 5: Extend the metrics read**

In `actions/admin-dashboard.ts`, add an optional `delta` to `AdminMetric`:

```ts
export type AdminMetric = {
    label: string
    value: number
    href: string
    /** Absent when no honest delta exists for this metric. */
    delta?: MetricDelta
}
```

Compute `previous` **only** for the three metrics that support it, adding one counting query each:

| Metric | `previous` |
|---|---|
| Problems | `SQLProblem.count({ where: { createdAt: { lt: since } } })` |
| Contests | `Contest.count({ where: { createdAt: { lt: since } } })` |
| Submissions (7d) | `Submission.count({ where: { createdAt: { gte: prior14, lt: since } } })` |

For Problems and Contests the current value is a running total, so `previous` is the total as of the period start and `change` is what was created during the period.

**Pass `previous: null` for Articles, Tracks, Open reports and Pending review.** No model carries `publishedAt`, and `updatedAt` moves on any edit, so a published-count delta cannot be computed; open reports and pending review are queue depths, where growth has no meaning.

Accept a `now: Date = new Date()` parameter on `getAdminDashboardMetrics` so tests can pin it.

- [ ] **Step 6: Wire the suite into CI and commit**

```json
"test:metric-delta": "node --import tsx --test scripts/test-metric-delta.ts",
```

```yaml
      - name: Admin metric deltas
        run: npm run test:metric-delta
```

```bash
git add lib/admin/metric-delta.ts scripts/test-metric-delta.ts actions/admin-dashboard.ts package.json .github/workflows/test.yml
git commit -m "feat(admin): compute metric deltas where they are honest"
```

---

### Task 5: The Overview screen

**Files:**
- Create: `components/admin/AdminQuickActions.tsx`, `components/admin/QueueStack.tsx`
- Modify: `components/admin/MetricCard.tsx`, `components/admin/AdminDashboard.tsx`, `app/admin/page.tsx`

**Interfaces:**
- Consumes: `AdminMetric` with its optional `delta` (Task 4).

- [ ] **Step 1: Quick actions, with the shortcuts actually wired**

`AdminQuickActions` renders four bordered buttons with `Kbd` chips: New problem `⌥P` → `/admin/problems/new`, article `⌥A` → `/admin/articles/new`, track `⌥T` → `/admin/tracks/new`, contest `⌥C` → `/admin/contests/new`.

**Each chip must be backed by a working listener.** A `keydown` handler on `window` checks `event.altKey` and the key, then navigates. Ignore the event when the target is an input, textarea or contenteditable, so the shortcut cannot fire while someone is typing.

This project has twice shipped a keyboard hint with no handler behind it — the `/` shortcut found in SP4 and the hero's `↵` in SP6. **If a chip cannot be wired, do not render the chip.**

Render the bar in the admin layout so it is reachable from every admin screen.

- [ ] **Step 2: The delta line**

`MetricCard` renders `metric.delta` when present: `direction: "up"` in `text-easy`, `"down"` in `text-destructive`, `"flat"` in `text-muted-foreground`, with a Lucide `ArrowUp`/`ArrowDown`/`Minus` and the signed change in `tabular-nums`.

**When `delta` is absent, render no line at all** — not a dash, not a grey zero. The card is simply shorter.

- [ ] **Step 3: The queue stack**

`QueueStack` renders three cards — open reports (Triage → `/admin/reports`), articles awaiting review (Review → `/admin/articles?status=SUBMITTED`), flagged comments (Moderate → `/admin/discussions`) — each tinted with its own semantic colour.

**Each needs an honest empty state.** An empty queue is good news: render "Nothing waiting" rather than a bare `0` or a broken-looking card. Do not hide the card — a missing queue reads as a bug, whereas an explicitly empty one reads as done.

- [ ] **Step 4: Assemble**

`AdminDashboard` renders the metric grid (five cards — Problems, Articles, Tracks, Contests, Submissions 7d), then two columns: recent activity in its current shape on the left, `QueueStack` on the right.

**Do not invent a sixth metric to fill the grid.** The design's six-up grid assumed seven metrics minus one; two moved into the queue stack, leaving five. Five real cards beat six with one fabricated.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run check:token-parity && npm run check:theme-utilities && npm run build
```

Then describe what the Overview renders for a database with zero reports, zero pending articles and zero flagged comments — the production shape.

- [ ] **Step 6: Commit**

```bash
git add -A components/admin app/admin/page.tsx
git commit -m "feat(admin): rebuild the overview with queues and honest deltas"
```

---

### Task 6: Overview e2e

**Files:**
- Create: `tests/e2e/admin-overview.spec.ts`

- [ ] **Step 1: Write the tests**

Cover:
1. An admin sees the five metric cards.
2. **A metric without an honest delta renders no delta line** — assert absence, not presence of a zero.
3. An empty queue card renders its honest empty state rather than a bare `0`.
4. **A quick-action shortcut actually navigates**: press `Alt+P`, assert the URL becomes `/admin/problems/new`.

Test 4 is the one that would have caught both previously-shipped dead `Kbd` hints.

- [ ] **Step 2: Prove non-vacuity**

Break each and confirm failure — for test 2, make `MetricCard` always render a delta line; for test 4, remove the keydown listener. Revert both and confirm `git diff` on non-test files is empty.

- [ ] **Step 3: Run and commit**

```bash
npm run build && npm run test:e2e -- admin-overview
git add tests/e2e/admin-overview.spec.ts
git commit -m "test(admin): cover the overview, its deltas and its shortcuts"
gh pr create --base main --title "feat(admin): SP7 phase 2 — the overview"
```

---

## Phase 3 — Problems list

### Task 7: Search and filter

**Files:**
- Create: `lib/admin/problems-filter.ts`, `components/admin/ProblemsListClient.tsx`
- Test: `scripts/test-problems-filter.ts`
- Modify: `app/admin/problems/page.tsx`, `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Produces:

```ts
export type ProblemStatusFilter = "ALL" | "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"

export interface FilterableProblem {
    number: number
    title: string
    slug: string
    status: string
}

/** Case-insensitive match on title or slug, plus status. Both narrow. */
export function filterProblems<T extends FilterableProblem>(
    problems: T[],
    query: string,
    status: ProblemStatusFilter
): T[]
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-problems-filter.ts`:

```ts
// Unit tests for the admin problems-list filter.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-problems-filter.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { filterProblems } from "../lib/admin/problems-filter"

const ROWS = [
    { number: 1, title: "Simple Select", slug: "simple-select", status: "PUBLISHED" },
    { number: 2, title: "Window Functions", slug: "window-functions", status: "DRAFT" },
    { number: 3, title: "Recursive CTE", slug: "recursive-cte", status: "PUBLISHED" },
]

const keys = (rows: typeof ROWS) => rows.map((r) => r.slug)

describe("filterProblems", () => {
    it("returns everything for an empty query and ALL", () => {
        assert.equal(filterProblems(ROWS, "", "ALL").length, 3)
    })

    it("matches title case-insensitively", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "window", "ALL")), ["window-functions"])
    })

    it("matches slug as well as title", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "recursive-cte", "ALL")), ["recursive-cte"])
    })

    it("ignores surrounding whitespace", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "  window  ", "ALL")), ["window-functions"])
    })

    it("filters by status", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "", "DRAFT")), ["window-functions"])
    })

    it("narrows on both together", () => {
        assert.deepEqual(keys(filterProblems(ROWS, "e", "PUBLISHED")), [
            "simple-select",
            "recursive-cte",
        ])
    })

    it("returns empty rather than everything when nothing matches", () => {
        assert.deepEqual(filterProblems(ROWS, "zzz", "ALL"), [])
    })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --import tsx --test scripts/test-problems-filter.ts` — FAIL, module not found.

- [ ] **Step 3: Implement**

Create `lib/admin/problems-filter.ts`. Trim and lowercase the query once, match against lowercased title and slug, and apply the status filter unless it is `"ALL"`.

The last test matters: a filter that returns everything when nothing matches is a common and silent bug.

- [ ] **Step 4: Run to verify passing** — exit 0.

- [ ] **Step 5: Build the client wrapper**

`ProblemsListClient` holds `query` and `status` in local `useState` — **not URL-synced**, matching SP4's catalog — and renders the search input plus a status segmented control above the existing table.

**The table's columns, grid and status pills are unchanged.** Only their colours move to Console tokens. Do not restructure the table.

Render an honest empty state when the filter matches nothing: state what was searched and offer to clear, rather than showing an empty grid.

`app/admin/problems/page.tsx` keeps its existing `findMany` and passes the rows down. **Do not add pagination in this task** — it is not designed, and the list is small at current scale.

- [ ] **Step 6: Wire into CI and commit**

```json
"test:problems-filter": "node --import tsx --test scripts/test-problems-filter.ts",
```

```yaml
      - name: Admin problems filter
        run: npm run test:problems-filter
```

```bash
git add lib/admin/problems-filter.ts scripts/test-problems-filter.ts components/admin/ProblemsListClient.tsx app/admin/problems/page.tsx package.json .github/workflows/test.yml
git commit -m "feat(admin): add search and status filtering to the problems list"
```

---

### Task 8: Problems list e2e

**Files:**
- Create: `tests/e2e/admin-problems.spec.ts`

- [ ] **Step 1: Write the tests**

Cover: typing in the search narrows the visible rows; the status filter narrows them; a query matching nothing shows the empty state rather than an empty grid; clearing restores the full list.

Seed your own problems with a unique prefix and clean them up. **Do not mutate ambient rows.**

- [ ] **Step 2: Prove non-vacuity, run, and commit**

Break the filter so it returns all rows regardless of query; confirm the narrowing test fails; revert.

```bash
npm run build && npm run test:e2e -- admin-problems
git add tests/e2e/admin-problems.spec.ts
git commit -m "test(admin): cover problems-list search and filtering"
gh pr create --base main --title "feat(admin): SP7 phase 3 — the problems list"
```

---

## Phase 4 — Problem form

### Task 9: Tab identity and error routing

**Files:**
- Create: `lib/admin/form-tabs.ts`
- Test: `scripts/test-form-tabs.ts`
- Modify: `package.json`, `.github/workflows/test.yml`

**Interfaces:**
- Produces:

```ts
export type FormTabId = "basics" | "schema" | "solution" | "hints" | "curriculum"

export const FORM_TABS: { id: FormTabId; label: string }[]

/** Which tab owns a given form field. */
export function tabForField(field: string): FormTabId | null

/** Tabs containing at least one errored field, in tab order. */
export function tabsWithErrors(fields: string[]): FormTabId[]

/** The tab a failed save should switch to, or null when there are none. */
export function firstErroredTab(fields: string[]): FormTabId | null
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-form-tabs.ts`:

```ts
// Unit tests for problem-form tab identity and error routing.
// No React, no DOM, no database.
//
// Run: node --import tsx --test scripts/test-form-tabs.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    FORM_TABS,
    tabForField,
    tabsWithErrors,
    firstErroredTab,
} from "../lib/admin/form-tabs"

describe("FORM_TABS", () => {
    it("is the five designed tabs in order", () => {
        assert.deepEqual(FORM_TABS.map((t) => t.id), [
            "basics",
            "schema",
            "solution",
            "hints",
            "curriculum",
        ])
    })
})

describe("tabForField", () => {
    it("routes known fields", () => {
        assert.equal(tabForField("title"), "basics")
        assert.equal(tabForField("slug"), "basics")
        assert.equal(tabForField("schemaId"), "schema")
        assert.equal(tabForField("solutionSql"), "solution")
        assert.equal(tabForField("expectedOutput"), "solution")
        assert.equal(tabForField("hints"), "hints")
        // A FORM field name, not a database column. There is deliberately no
        // lessonId column on SQLProblem — the binding lives in
        // LessonCheckpoint. See Task 11.
        assert.equal(tabForField("curriculumLessonId"), "curriculum")
    })

    it("returns null for an unknown field rather than guessing", () => {
        assert.equal(tabForField("nonexistent"), null)
    })
})

describe("tabsWithErrors", () => {
    it("returns tabs in tab order, not input order", () => {
        assert.deepEqual(tabsWithErrors(["solutionSql", "title"]), ["basics", "solution"])
    })

    it("de-duplicates", () => {
        assert.deepEqual(tabsWithErrors(["title", "slug"]), ["basics"])
    })

    it("ignores unknown fields", () => {
        assert.deepEqual(tabsWithErrors(["nonexistent"]), [])
    })

    it("is empty for no errors", () => {
        assert.deepEqual(tabsWithErrors([]), [])
    })
})

describe("firstErroredTab", () => {
    it("picks the earliest tab in tab order", () => {
        // Both fields must be MAPPED, or this passes for the wrong reason:
        // an unmapped field is ignored, so ordering would never be exercised.
        assert.equal(firstErroredTab(["curriculumLessonId", "title"]), "basics")
    })

    it("returns null when nothing errored", () => {
        assert.equal(firstErroredTab([]), null)
    })
})
```

- [ ] **Step 2: Run to verify failure** — module not found.

- [ ] **Step 3: Implement**

Create `lib/admin/form-tabs.ts` with a field→tab map covering every field the form renders. `tabForField` returns `null` for anything unmapped — **do not default to `"basics"`**, because a silently mis-routed error is exactly the failure tabs introduce.

- [ ] **Step 4: Run to verify passing** — exit 0.

- [ ] **Step 5: Wire into CI and commit**

```json
"test:form-tabs": "node --import tsx --test scripts/test-form-tabs.ts",
```

```yaml
      - name: Admin form tabs
        run: npm run test:form-tabs
```

```bash
git add lib/admin/form-tabs.ts scripts/test-form-tabs.ts package.json .github/workflows/test.yml
git commit -m "feat(admin): add problem-form tab identity and error routing"
```

---

### Task 10: The tabbed form

**Files:**
- Modify: `components/admin/ProblemForm.tsx` (and split into `components/admin/problem-form/` if it grows past readability)

**Interfaces:**
- Consumes: `FORM_TABS`, `tabsWithErrors`, `firstErroredTab` (Task 9).

**Read `components/admin/ProblemForm.tsx` in full before changing anything.** Its Run-and-capture loop and per-dialect `solutions`/`expectedOutputs` handling work today and are not being redesigned.

- [ ] **Step 1: Add the tab strip, keeping every field mounted**

Render `FORM_TABS` as a strip above the two panes. Switching tabs toggles **visibility** — `hidden`, not conditional rendering.

**Every field stays mounted at all times.** Unmounting a tab discards whatever was typed into it; losing half an authored problem to a tab switch is the exact failure this rule prevents. This is the same constraint SP6's mobile panes needed, and the guard there had to assert DOM presence rather than value survival, because lifted state made the naive check vacuous. Expect the same subtlety here.

- [ ] **Step 2: Surface errors on the strip**

A tab whose id appears in `tabsWithErrors(erroredFieldNames)` gets a `text-destructive` marker. On a failed save, switch to `firstErroredTab(...)`.

An invalid field on a hidden tab with no indication is the single most likely bug this redesign could introduce on the most-used authoring screen.

- [ ] **Step 3: Segmented controls and toggle chips**

Difficulty and status become segmented controls rather than `<select>`s. SQL engines become toggle chips. Both keep their existing values and submit identically — this is presentation only.

- [ ] **Step 4: The validation checklist**

Below the authoring loop, render three checks: solution runs clean on both engines; expected output captured and non-empty; and a warning when the problem has no tags, since it will then appear under no topic.

These surface state the form already knows. **Do not add new validation rules** — this task makes existing conditions visible, it does not change what is accepted.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit && npm run check:token-parity && npm run check:theme-utilities && npm run build
```

Then exercise the mounted-fields guarantee by hand: type into a field on Basics, switch to Hints, switch back, and confirm the text survived. Describe what you did and what happened.

- [ ] **Step 6: Commit**

```bash
git add -A components/admin
git commit -m "feat(admin): tab the problem form with errors surfaced on the strip"
```

---

### Task 11: Curriculum placement, and the phase e2e

**Files:**
- Create: `components/admin/problem-form/CurriculumPlacement.tsx`, `tests/e2e/admin-problem-form.spec.ts`
- Modify: `app/api/admin/problems/[slug]/route.ts` if a checkpoint write path is needed

**Read first:** `lib/admin-curriculum.ts` — specifically `addCheckpoint`, `removeCheckpoint` and `reorderCheckpoints`.

- [ ] **Step 1: Build the panel**

A violet-tinted panel on the Curriculum tab, binding the problem to the lesson it checks plus its checkpoint order.

Three rules, all load-bearing:

1. **Backed by the existing `LessonCheckpoint` relation. No new columns.** The design proposed adding `lessonId` + `checkpointOrder` to `SQLProblem`; `LessonCheckpoint` already stores exactly that, and duplicating it would give one fact two homes — the bug class this redesign has hit four times.
2. **Every write goes through `addCheckpoint` / `removeCheckpoint` / `reorderCheckpoints`.** Never write `position` directly; those transactions are what keep positions gapless and unique.
3. **`LessonCheckpoint` has `@@unique([problemId])`, so a problem is the checkpoint of exactly one lesson.** The panel must say so plainly, and moving a problem means reassigning it, not adding a second binding.

**With no curriculum present the panel must degrade honestly** — production currently has zero modules and zero lessons, so this is the live path, not an edge case. Say that no lessons exist yet and link to where one is created; do not render an empty picker.

- [ ] **Step 2: Write the e2e**

Cover:
1. Field values survive a tab switch — assert the *field is still in the DOM* while hidden, not merely that its value reappears. A value-only assertion may be vacuous if state is lifted, which is exactly what happened in SP6.
2. A validation error marks its tab and a failed save switches to it.
3. The curriculum panel shows its honest empty state when no lessons exist.

Seed your own fixtures with a unique prefix; clean up; **do not mutate ambient rows**. If an assertion needs no ambient curriculum, detect-and-skip locally but **fail when `process.env.CI` is set**.

- [ ] **Step 3: Prove non-vacuity**

For test 1, switch a tab to conditional rendering, confirm the test fails, revert. Report what you broke and what happened, and confirm `git diff` on non-test files is empty.

- [ ] **Step 4: Run everything and open the PR**

```bash
npm run test:admin-nav && npm run test:metric-delta && npm run test:problems-filter && npm run test:form-tabs
npm run test:console-nav && npm run check:token-parity && npm run check:theme-utilities
npx tsc --noEmit && npm run build
npm run test:e2e -- admin-problem-form
```

```bash
git add -A
git commit -m "feat(admin): bind problems to lessons from the problem form"
gh pr create --base main --title "feat(admin): SP7 phase 4 — the problem form"
```

Then update `docs/ROADMAP.md` with an SP7 entry, and drop the "SP7 to confirm" comment from `--accent-violet` in `app/globals.css:160` once the light value has been seen in situ.
