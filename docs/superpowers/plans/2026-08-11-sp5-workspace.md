# SP5 Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the SQL practice workspace at `/practice/[slug]` as a four-column console app view — problems panel, lesson context bar, five-tab problem panel, editor — and add pass rate plus community approaches.

**Architecture:** A new `isAppRoute` predicate gives the route a footer-free, full-height shell while keeping SP2's console sidebar. Rendering moves out of three oversized files into `components/practice/workspace/`, with all decision logic extracted to pure modules under `lib/workspace/` so it unit-tests without a DOM. Two additive migrations follow the UI: denormalized pass-rate counters on `SQLProblem`, and community approaches as a `kind` discriminator on the existing `DiscussionComment`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Prisma 7 + PostgreSQL, Tailwind v4 with HSL token variables, Monaco, DuckDB-WASM / PGlite, `node --import tsx --test` for unit suites, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-11-sp5-workspace-design.md`

## Global Constraints

- **Four phases, four PRs, each `gh pr create --base main`.** The default branch is `production`; a forgotten `--base` deploys unfinished work to live.
- **Every new test script gets its line in `.github/workflows/test.yml` in the same PR that adds it.** Not a follow-up. This gap has already occurred twice (SP2, SP3).
- **Judge suites by exit code, never by grepping output.** Local is Node 26 (`ℹ pass 51`), CI is Node 20 (`# pass 51`).
- **Never hardcode Tailwind palette names or hex.** Semantic tokens only (`bg-panel`, `text-muted-foreground`, `border-line-soft`). `npm run check:token-parity` enforces `:root`/`.light` parity.
- **No emoji icons.** Lucide SVG only.
- **`npm run build` — never bare `next build`.** Turbopack panics on this code shape; `--webpack` is pinned in `package.json`.
- **Never export a `userId`-parameterised writer from a `"use server"` file.** Every export becomes a client-callable RPC endpoint. Resolve the session inside the action.
- **`npm run dev` binds to `.env.local`, which points at production Neon.** Prefix `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn'` for local data.
- **Positions move only through their reorder transactions.** Never write `ModuleLesson.position`, `LessonCheckpoint.position` or `ProblemListItem.position` outside them.
- **Under `@prisma/adapter-pg`, `P2002.meta.target` is always `undefined`.** Read `meta.driverAdapterError.cause.constraint.fields` and strip the quotes. See `isUniqueViolationOn` in `lib/admin-curriculum.ts`.

## Capability inventory — the refactor's real risk

SP2's whole-branch review found that deleting `Navbar.tsx` silently removed the theme toggle, mobile sign-out and the only `banner` landmark. None was visible to per-task review. Phase 2 splits three large files; **every item below exists today, appears nowhere in the design screenshots, and must still work when phase 2 ends.** Task 11 verifies them as a set.

| Capability | Lives today in |
|---|---|
| `⌘↵` Run / `⌘⇧↵` Submit shortcuts | `components/sql/SqlEditor.tsx:62-70` |
| Result-cap truncation warning | `components/sql/ResultTable.tsx` |
| Query-timeout recovery that resets the engine | `ProblemClient` + `lib/use-problem-db.ts` |
| `dl:query-timeout-ms` override | `ProblemClient.tsx:64` |
| DuckDB-introspection schema fallback when `parseSchema` returns `null` | `ProblemClient.tsx:163-216` |
| Per-hint voting | `ProblemPanel.tsx` `HintsTab` |
| `AddToListButton`, `ReportDialog` | `app/practice/[slug]/page.tsx` header |
| **Contest lock banner + `submissionDisabledReason`** | `app/practice/[slug]/page.tsx:195-210` — blocks Submit while the problem is in a contest |
| `data-testid="workspace-run-editor"` / `workspace-run-footer` | asserted by `tests/e2e/sql-engine.spec.ts` |
| `dl:draft:<slug>`, `dl:dialect:<slug>` | asserted by `tests/e2e/sql-engine.spec.ts` |

---

## Phase 1 — Shell

PR title: `feat(workspace): give app routes a footer-free full-height shell`

## File Structure

- Modify: `components/layout/console/focus-route.ts` — add `isAppRoute`
- Modify: `components/layout/console/ConsoleChrome.tsx:50,114-136` — branch on it
- Modify: `scripts/test-console-nav.ts` — predicate + exclusivity tests
- Create: `scripts/check-theme-utilities.ts` — the `@theme inline` guard
- Modify: `package.json`, `.github/workflows/test.yml`

---

### Task 1: The `isAppRoute` predicate

**Files:**
- Modify: `components/layout/console/focus-route.ts`
- Test: `scripts/test-console-nav.ts` (already wired into CI — no workflow change needed for this task)

**Interfaces:**
- Consumes: nothing.
- Produces: `isAppRoute(pathname: string): boolean`, exported from `components/layout/console/focus-route.ts`. Task 2 imports it.

- [ ] **Step 1: Write the failing tests**

Append to `scripts/test-console-nav.ts`. Add `isAppRoute` to the existing import on line 21.

```ts
describe("isAppRoute", () => {
    it("matches a problem workspace", () => {
        assert.equal(isAppRoute("/practice/second-highest-salary"), true)
    })

    it("does not match the practice catalog one level up", () => {
        // SP4's catalog is a normal scrolling page and keeps its footer.
        assert.equal(isAppRoute("/practice"), false)
    })

    it("does not match a deeper path under practice", () => {
        assert.equal(isAppRoute("/practice/a/b"), false)
    })

    it("tolerates a trailing slash", () => {
        assert.equal(isAppRoute("/practice/two-sum/"), true)
    })

    it("does not match the root", () => {
        assert.equal(isAppRoute("/"), false)
    })
})

describe("shell modes are mutually exclusive", () => {
    // Three shell modes is one more than anyone holds in their head
    // reliably. This is what makes the third one safe to add.
    const ROUTES = [
        "/",
        "/practice",
        "/practice/two-sum",
        "/learn",
        "/learn/tracks",
        "/learn/tracks/analyst-interview-prep",
        "/learn/tracks/analyst-interview-prep/sessionisation",
        "/learn/sql-basics/joins",
        "/profile",
        "/lists",
        "/admin",
        "/admin/problems",
    ]

    it("never reports a path as both focus and app", () => {
        for (const route of ROUTES) {
            assert.equal(
                isFocusRoute(route) && isAppRoute(route), false,
                `${route} resolved to two shell modes`,
            )
        }
    })

    it("has no nav item pointing at an app route", () => {
        // Mirrors the existing focus-route guard: nav lives in the shell,
        // so a nav entry may point at an app route (the shell survives) —
        // but the tab bar must not, since app routes suppress page scroll
        // and the tab bar is the only nav below lg.
        for (const item of TAB_BAR) {
            for (const candidate of [item, ...(item.children ?? [])]) {
                if (!candidate.href) continue
                assert.equal(
                    isAppRoute(candidate.href), false,
                    `tab bar item "${candidate.key}" points at app route ${candidate.href}`,
                )
            }
        }
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:console-nav`
Expected: FAIL — `isAppRoute is not exported from ../components/layout/console/focus-route`

- [ ] **Step 3: Implement the predicate**

Append to `components/layout/console/focus-route.ts`:

```ts
/**
 * Whether a path is an "app mode" route — one that sits inside the console
 * shell but behaves like an application view rather than a document: no
 * footer, and no page scroll at `lg` and above, because its inner panes own
 * their own scrolling.
 *
 * Today that is exactly the problem workspace: /practice/<slug>. The catalog
 * one level up (/practice) is an ordinary scrolling page, so segment count is
 * the discriminator, not a prefix match — the same rule isFocusRoute uses.
 *
 * INVARIANT: no path may satisfy both isAppRoute and isFocusRoute. Enforced
 * in scripts/test-console-nav.ts.
 */
export function isAppRoute(pathname: string): boolean {
    const segments = pathname.split("/").filter(Boolean)
    return segments.length === 2 && segments[0] === "practice"
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:console-nav`
Expected: PASS, exit 0. Count rises from 51.

- [ ] **Step 5: Commit**

```bash
git add components/layout/console/focus-route.ts scripts/test-console-nav.ts
git commit -m "feat(console): add isAppRoute predicate for full-height routes"
```

---

### Task 2: ConsoleChrome renders the app mode

**Files:**
- Modify: `components/layout/console/ConsoleChrome.tsx:50,114-136`
- Test: `tests/e2e/workspace-shell.spec.ts` (create)
- Modify: `.github/workflows/test.yml` — none needed; `test:e2e` already runs the whole Playwright suite

**Interfaces:**
- Consumes: `isAppRoute` from Task 1.
- Produces: the DOM contract phase 2 builds against — on `/practice/<slug>` there is exactly one `banner`, a `<main id="main-content">`, **no** `contentinfo`, and `#app-scroll` is `overflow-hidden` at `lg`+.

- [ ] **Step 1: Write the failing e2e test**

Create `tests/e2e/workspace-shell.spec.ts`:

```ts
import { test, expect } from "@playwright/test"

// The workspace is an app-mode route: console shell, but no footer and no
// page scroll. Asserted by landmark, not by screenshot — a footer below the
// fold looks identical to a footer that isn't there.
test.describe("workspace shell", () => {
    test("has no contentinfo landmark", async ({ page }) => {
        await page.goto("/practice/second-highest-salary")
        await expect(page.getByRole("contentinfo")).toHaveCount(0)
    })

    test("keeps exactly one banner and the main landmark", async ({ page }) => {
        await page.goto("/practice/second-highest-salary")
        await expect(page.getByRole("banner")).toHaveCount(1)
        await expect(page.locator("main#main-content")).toHaveCount(1)
    })

    test("the catalog one level up still has its footer", async ({ page }) => {
        await page.goto("/practice")
        await expect(page.getByRole("contentinfo")).toHaveCount(1)
    })

    test("#app-scroll does not scroll at lg and above", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto("/practice/second-highest-salary")
        const overflow = await page
            .locator("#app-scroll")
            .evaluate((el) => getComputedStyle(el).overflowY)
        expect(overflow).toBe("hidden")
    })
})
```

> Use a slug that exists in the seed. Confirm with `npx tsx -e "..."` against local Postgres, or read `prisma/seed.ts`, before running.

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:e2e -- workspace-shell`
Expected: FAIL — `contentinfo` resolves to 1, and `overflowY` is `auto`.

- [ ] **Step 3: Implement the branch**

In `ConsoleChrome.tsx`, import `isAppRoute` alongside `isFocusRoute` on line 6, then after line 50:

```tsx
const focus = isFocusRoute(pathname)
const app = isAppRoute(pathname)
```

Replace the `#app-scroll` className expression (lines 116-120) with:

```tsx
className={
    focus
        ? "flex flex-1 flex-col overflow-y-auto print:overflow-visible"
        : app
          ? "flex flex-1 flex-col overflow-y-auto pb-14 lg:overflow-hidden lg:pb-0 print:overflow-visible print:pb-0"
          : "flex flex-1 flex-col overflow-y-auto pb-14 lg:pb-0 print:overflow-visible print:pb-0"
}
```

Replace the non-focus branch (lines 124-135) with:

```tsx
<>
    <main
        id="main-content"
        tabIndex={-1}
        className={
            app
                ? "flex flex-1 flex-col focus:outline-none lg:min-h-0"
                : "flex flex-1 flex-col focus:outline-none"
        }
    >
        {children}
    </main>
    {!app && footerSlot}
</>
```

Extend the comment block above `#app-scroll` to say why app mode drops the footer: a workspace is an application view, its panes own their scrolling, and a footer inside a clamped container is unreachable rather than merely out of the way.

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:e2e -- workspace-shell`
Expected: PASS, 4 tests.

Then confirm nothing else moved:

Run: `npm run test:console-nav && npm run test:scroll-restoration && npm run test:e2e -- lesson-reader`
Expected: all exit 0. The reader is the other shell-mode consumer and is the thing most likely to break.

- [ ] **Step 5: Commit**

```bash
git add components/layout/console/ConsoleChrome.tsx tests/e2e/workspace-shell.spec.ts
git commit -m "feat(console): drop footer and page scroll on app routes"
```

---

### Task 3: The `@theme inline` utility guard

Closes handoff follow-up 3. `check:token-parity` diffs `:root` against `.light` and never inspects `@theme inline`, where the variable→utility mapping lives — two dead classes passed it cleanly during SP3. Phase 2 introduces `panel-raised`, `primary-row` and `line-strong`, so the guard lands before the classes do.

**Files:**
- Create: `scripts/check-theme-utilities.ts`
- Modify: `package.json` (script), `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm run check:theme-utilities`, exit 0 when clean, exit 1 listing every offending class with its file and line.

- [ ] **Step 1: Write the failing test**

Create `scripts/check-theme-utilities.ts`. It scans `app/`, `components/` and `lib/` for `bg-`, `text-`, `border-`, `ring-`, `fill-` and `stroke-` classes whose suffix looks like a project token, and asserts each has a matching `--color-<name>` declaration inside the `@theme inline` block of `app/globals.css`.

```ts
// Guard: every semantic colour utility used in the app resolves to a
// --color-* variable declared in @theme inline. check:token-parity cannot
// catch this — it only diffs :root against .light, so a token that exists
// but was never mapped to a utility produces a class that silently does
// nothing. Two such classes shipped in SP3.
//
// Run: npx tsx scripts/check-theme-utilities.ts

import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

// NB: do not reach for fs.globSync — it landed in Node 22 and CI pins
// Node 20 (.github/workflows/test.yml `node-version: "20"`). It would pass
// locally on Node 26 and fail only in CI.
function walk(dir: string, exts: string[], out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) continue
        const full = join(dir, entry.name)
        if (entry.isDirectory()) walk(full, exts, out)
        else if (exts.some((e) => entry.name.endsWith(e))) out.push(full)
    }
    return out
}

const GLOBALS = "app/globals.css"
const UTILITY_PREFIXES = ["bg", "text", "border", "ring", "fill", "stroke"]

function themeInlineNames(css: string): Set<string> {
    const block = css.match(/@theme\s+inline\s*\{([\s\S]*?)\n\}/)
    if (!block) {
        console.error(`${GLOBALS}: no @theme inline block found`)
        process.exit(1)
    }
    const names = new Set<string>()
    for (const m of block[1].matchAll(/--color-([a-z0-9-]+)\s*:/g)) {
        names.add(m[1])
    }
    return names
}
```

Complete the file so it: reads `app/globals.css`; builds the declared set; walks `app/**/*.tsx`, `components/**/*.tsx`, `lib/**/*.ts` with `globSync`; for each `className` string extracts candidate utilities with `/\b(?:bg|text|border|ring|fill|stroke)-([a-z][a-z0-9-]*)\b/g`; skips Tailwind built-ins by allowlist (`transparent`, `current`, `inherit`, `white`, `black`, plus sizing words that collide such as `border-2`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-left`, `text-center`, `text-right`); reports every remaining name absent from the declared set as `path:line  bg-foo`; and exits 1 if the list is non-empty.

Write the guard's own fixture test first — a temp file containing `className="bg-definitely-not-a-token"` — and assert the script exits 1 and names it. A guard that passes because it found nothing to check is the exact failure shape the handoff calls pattern 3.

- [ ] **Step 2: Run to verify it fails**

Run: `npx tsx scripts/check-theme-utilities.ts`
Expected: FAIL on the fixture — exit 1, listing `bg-definitely-not-a-token`.

- [ ] **Step 3: Make it pass on the real tree**

Delete the fixture. Run the guard against the repo. If it reports classes, each is either a real dead class (fix it, and note it in the PR — this is the SP3 residue the guard exists to find) or a false positive (extend the allowlist, with a comment saying why).

- [ ] **Step 4: Wire it up and verify**

`package.json`, beside `check:token-parity`:

```json
"check:theme-utilities": "tsx scripts/check-theme-utilities.ts",
```

`.github/workflows/test.yml`, immediately after the `Check token theme parity` step:

```yaml
      - name: Check theme utility mapping
        run: npm run check:theme-utilities
```

Run: `npm run check:theme-utilities && npm run check:token-parity`
Expected: both exit 0.

Verify the workflow still parses — there is no yaml module in the repo, so:

Run: `npx --yes js-yaml .github/workflows/test.yml > /dev/null && echo "yaml ok"`
Expected: `yaml ok`

- [ ] **Step 5: Commit and open the phase 1 PR**

```bash
git add scripts/check-theme-utilities.ts package.json .github/workflows/test.yml
git commit -m "ci: guard that colour utilities resolve to @theme inline tokens"
gh pr create --base main --title "feat(workspace): give app routes a footer-free full-height shell" --body-file <(cat <<'EOF'
## Summary
Adds the third console shell mode SP5 needs, plus the token guard that closes handoff follow-up 3.
## Verified
- test:console-nav green with the new predicate and exclusivity assertions
- e2e workspace-shell: no contentinfo, one banner, #app-scroll clamped at lg
- lesson-reader e2e still green (the other shell-mode consumer)
## Not yet verified
- Nothing renders in the new mode yet; the workspace still uses the old layout.
EOF
)
```

> This PR touches `.github/workflows/`, so it needs a **web-UI merge** — the local `gh` token lacks `workflow` scope.

---

## Phase 2 — Layout

PR title: `feat(workspace): rebuild the workspace as a four-column console view`

No schema change. **The workspace redesign is complete and shippable when this phase ends**, with the Solutions tab carrying only the canonical solution.

## File Structure

- Create: `lib/workspace/problems-panel-model.ts` — grouping, filtering, fractions. Pure.
- Create: `lib/workspace/checkpoint-context.ts` — shapes the context bar's data. Pure.
- Create: `actions/workspace.ts` — `getWorkspaceProblemsPanel`, `getCheckpointContext`
- Create: `components/practice/workspace/WorkspaceLayout.tsx` — columns + overlay, owns `problemsPanelOpen`
- Create: `components/practice/workspace/ProblemsPanel.tsx`
- Create: `components/practice/workspace/LessonContextBar.tsx`
- Create: `components/practice/workspace/CollapsibleSection.tsx`
- Create: `components/practice/workspace/ProblemTabs.tsx` + `tabs/{Description,Hints,Solutions,Discussion,History}Tab.tsx`
- Create: `components/practice/workspace/{EditorPane,ResultsPane,ActionBar}.tsx`
- Modify: `components/practice/ProblemClient.tsx` — keeps state, sheds rendering
- Delete: `components/practice/ProblemPanel.tsx`, `components/sql/SqlPlayground.tsx` (absorbed)
- Create: `scripts/test-problems-panel.ts`, `tests/e2e/workspace.spec.ts`

---

### Task 4: The problems-panel model

**Files:**
- Create: `lib/workspace/problems-panel-model.ts`
- Test: `scripts/test-problems-panel.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Consumes: nothing — pure, no Prisma, no React.
- Produces:

```ts
export type PanelProblem = {
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    solved: boolean
    moduleId: string | null
    modulePosition: number | null
    moduleTitle: string | null
    tags: string[]
}

export type PanelGroup = {
    key: string          // moduleId, tag slug, or "__ungrouped__"
    label: string        // "04 · Window functions" | "window-functions" | "Not in a track"
    done: number
    total: number
    problems: PanelProblem[]
}

export type PanelMode = "track" | "todo" | "tags"

export function buildPanelGroups(
    problems: PanelProblem[],
    mode: PanelMode,
    filter: string,
): PanelGroup[]
```

- [ ] **Step 1: Write the failing tests**

Create `scripts/test-problems-panel.ts`:

```ts
// Unit tests for the problems-panel grouping model. No React, no DOM,
// no database.
//
// Run: node --import tsx --test scripts/test-problems-panel.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    buildPanelGroups,
    type PanelProblem,
} from "../lib/workspace/problems-panel-model"

function p(over: Partial<PanelProblem>): PanelProblem {
    return {
        number: 1,
        slug: "s",
        title: "T",
        difficulty: "EASY",
        solved: false,
        moduleId: null,
        modulePosition: null,
        moduleTitle: null,
        tags: [],
        ...over,
    }
}

describe("buildPanelGroups — track mode", () => {
    it("orders groups by module position", () => {
        const groups = buildPanelGroups([
            p({ number: 2, moduleId: "m4", modulePosition: 4, moduleTitle: "Window functions" }),
            p({ number: 1, moduleId: "m3", modulePosition: 3, moduleTitle: "Aggregation" }),
        ], "track", "")
        assert.deepEqual(groups.map((g) => g.label), [
            "03 · Aggregation",
            "04 · Window functions",
        ])
    })

    it("puts problems with no module in a final Not in a track group", () => {
        const groups = buildPanelGroups([
            p({ number: 9, slug: "loose" }),
            p({ number: 1, moduleId: "m1", modulePosition: 1, moduleTitle: "Basics" }),
        ], "track", "")
        assert.equal(groups.length, 2)
        assert.equal(groups[1].key, "__ungrouped__")
        assert.equal(groups[1].label, "Not in a track")
    })

    it("orders ungrouped problems by number", () => {
        const groups = buildPanelGroups([
            p({ number: 30, slug: "c" }),
            p({ number: 10, slug: "a" }),
            p({ number: 20, slug: "b" }),
        ], "track", "")
        assert.deepEqual(groups[0].problems.map((x) => x.slug), ["a", "b", "c"])
    })

    it("counts done/total per group", () => {
        const groups = buildPanelGroups([
            p({ number: 1, moduleId: "m1", modulePosition: 1, moduleTitle: "Basics", solved: true }),
            p({ number: 2, moduleId: "m1", modulePosition: 1, moduleTitle: "Basics" }),
            p({ number: 3, moduleId: "m1", modulePosition: 1, moduleTitle: "Basics" }),
        ], "track", "")
        assert.equal(groups[0].done, 1)
        assert.equal(groups[0].total, 3)
    })
})

describe("buildPanelGroups — todo mode", () => {
    it("drops solved problems", () => {
        const groups = buildPanelGroups([
            p({ number: 1, slug: "done", solved: true }),
            p({ number: 2, slug: "open" }),
        ], "todo", "")
        const slugs = groups.flatMap((g) => g.problems.map((x) => x.slug))
        assert.deepEqual(slugs, ["open"])
    })

    it("drops a group that empties completely", () => {
        const groups = buildPanelGroups([
            p({ number: 1, moduleId: "m1", modulePosition: 1, moduleTitle: "Basics", solved: true }),
        ], "todo", "")
        assert.deepEqual(groups, [])
    })

    it("keeps totals honest — done/total describe what is shown", () => {
        const groups = buildPanelGroups([
            p({ number: 1, moduleId: "m1", modulePosition: 1, moduleTitle: "B", solved: true }),
            p({ number: 2, moduleId: "m1", modulePosition: 1, moduleTitle: "B" }),
        ], "todo", "")
        assert.equal(groups[0].total, 1)
        assert.equal(groups[0].done, 0)
    })
})

describe("buildPanelGroups — tags mode", () => {
    it("groups by tag and repeats a problem under each of its tags", () => {
        const groups = buildPanelGroups([
            p({ number: 1, slug: "both", tags: ["joins", "window-functions"] }),
        ], "tags", "")
        assert.deepEqual(groups.map((g) => g.key).sort(), ["joins", "window-functions"])
    })

    it("puts untagged problems in the ungrouped bucket last", () => {
        const groups = buildPanelGroups([
            p({ number: 1, slug: "bare" }),
            p({ number: 2, slug: "tagged", tags: ["joins"] }),
        ], "tags", "")
        assert.equal(groups[groups.length - 1].key, "__ungrouped__")
    })
})

describe("buildPanelGroups — filter", () => {
    it("matches title case-insensitively", () => {
        const groups = buildPanelGroups([
            p({ number: 1, slug: "a", title: "Second highest salary" }),
            p({ number: 2, slug: "b", title: "Duplicate emails" }),
        ], "track", "SALARY")
        assert.deepEqual(groups[0].problems.map((x) => x.slug), ["a"])
    })

    it("matches the problem number", () => {
        const groups = buildPanelGroups([
            p({ number: 247, slug: "a", title: "Second highest salary" }),
            p({ number: 119, slug: "b", title: "Duplicate emails" }),
        ], "track", "247")
        assert.deepEqual(groups[0].problems.map((x) => x.slug), ["a"])
    })

    it("returns no groups when nothing matches", () => {
        const groups = buildPanelGroups([p({ title: "Joins" })], "track", "zzz")
        assert.deepEqual(groups, [])
    })

    it("ignores surrounding whitespace", () => {
        const groups = buildPanelGroups([p({ slug: "a", title: "Joins" })], "track", "  joins  ")
        assert.equal(groups[0].problems.length, 1)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:problems-panel`
Expected: FAIL — script not defined yet, then module not found. Add the `package.json` line in step 4; for now run `node --import tsx --test scripts/test-problems-panel.ts` and expect a module-resolution failure.

- [ ] **Step 3: Implement the model**

Create `lib/workspace/problems-panel-model.ts` with the types above. Rules, in this order:

1. **Filter first**, then group — so `done/total` describe what is on screen, which is what the tests assert. Match on lowercased title substring or exact `String(number)`; trim the filter.
2. **`todo` mode** drops `solved` problems, then groups by module exactly as `track` does. Groups that empty out are removed.
3. **`track` mode** groups by `moduleId`, ordered by `modulePosition` ascending. Label is `String(modulePosition).padStart(2, "0") + " · " + moduleTitle`. Problems within a group keep the order they arrive in (the caller supplies curriculum order).
4. **`tags` mode** groups by each tag slug, alphabetically; a problem with two tags appears in both groups. Label is the tag slug.
5. **Ungrouped bucket** — key `__ungrouped__`, label `Not in a track`, always last, problems sorted by `number` ascending. In `tags` mode it holds untagged problems.
6. Never mutate the input array.

- [ ] **Step 4: Wire the script and verify**

`package.json`, after `test:console-nav`:

```json
"test:problems-panel": "node --import tsx --test scripts/test-problems-panel.ts",
```

`.github/workflows/test.yml`, after the `Test console nav model` step:

```yaml
      - name: Test problems panel model
        run: npm run test:problems-panel
```

Run: `npm run test:problems-panel`
Expected: PASS, exit 0, 14 tests.

Run: `npx --yes js-yaml .github/workflows/test.yml > /dev/null && echo "yaml ok"`
Expected: `yaml ok`

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/problems-panel-model.ts scripts/test-problems-panel.ts package.json .github/workflows/test.yml
git commit -m "feat(workspace): add the problems-panel grouping model"
```

---

### Task 5: The panel and checkpoint reads

**Files:**
- Create: `actions/workspace.ts`
- Create: `lib/workspace/checkpoint-context.ts`
- Modify: `app/practice/[slug]/page.tsx` — fetch and pass down

**Interfaces:**
- Consumes: `PanelProblem` from Task 4.
- Produces:

```ts
// actions/workspace.ts — both session-resolving, both React-cached
export async function getWorkspaceProblemsPanel(): Promise<PanelProblem[]>

export type CheckpointContext = {
    lessonSlug: string
    lessonTitle: string
    trackSlug: string
    moduleTitle: string
    modulePosition: number
    index: number        // 1-based: "Checkpoint 1 of 2"
    total: number
    nextProblemSlug: string | null   // null when this is the last checkpoint
}
export async function getCheckpointContext(problemId: string): Promise<CheckpointContext | null>
```

- [ ] **Step 1: Write the failing test**

`LessonCheckpoint` is `@@unique([problemId])`, so a problem belongs to at most one lesson and there is no tiebreak — but the **index/total/next** arithmetic is worth isolating. Put it in `lib/workspace/checkpoint-context.ts` as a pure function and test it in `scripts/test-problems-panel.ts` (same suite, already wired in Task 4):

```ts
import { resolveCheckpointPosition } from "../lib/workspace/checkpoint-context"

describe("resolveCheckpointPosition", () => {
    const siblings = [
        { problemSlug: "a", position: 0 },
        { problemSlug: "b", position: 1 },
        { problemSlug: "c", position: 2 },
    ]

    it("is 1-based for display", () => {
        const r = resolveCheckpointPosition(siblings, "a")!
        assert.equal(r.index, 1)
        assert.equal(r.total, 3)
    })

    it("points at the next sibling by position", () => {
        assert.equal(resolveCheckpointPosition(siblings, "b")!.nextProblemSlug, "c")
    })

    it("has no next on the last checkpoint", () => {
        assert.equal(resolveCheckpointPosition(siblings, "c")!.nextProblemSlug, null)
    })

    it("sorts by position, not by input order", () => {
        const shuffled = [siblings[2], siblings[0], siblings[1]]
        assert.equal(resolveCheckpointPosition(shuffled, "a")!.nextProblemSlug, "b")
    })

    it("returns null for a problem that is not a sibling", () => {
        assert.equal(resolveCheckpointPosition(siblings, "zzz"), null)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:problems-panel`
Expected: FAIL — `resolveCheckpointPosition` not exported.

- [ ] **Step 3: Implement**

`lib/workspace/checkpoint-context.ts` — pure, no Prisma:

```ts
export type CheckpointSibling = { problemSlug: string; position: number }

export function resolveCheckpointPosition(
    siblings: CheckpointSibling[],
    problemSlug: string,
): { index: number; total: number; nextProblemSlug: string | null } | null {
    const ordered = [...siblings].sort((a, b) => a.position - b.position)
    const at = ordered.findIndex((s) => s.problemSlug === problemSlug)
    if (at === -1) return null
    return {
        index: at + 1,
        total: ordered.length,
        nextProblemSlug: ordered[at + 1]?.problemSlug ?? null,
    }
}
```

`actions/workspace.ts` — `"use server"`, both functions resolve the session themselves and take no `userId` argument:

- `getWorkspaceProblemsPanel` selects published problems (`number, slug, title, difficulty, tags`), joins module membership through the curriculum models, and folds in the caller's solved set the way `lib/curriculum-read.ts:166-176` already does. Wrap in React `cache()`. Signed-out callers get `solved: false` throughout rather than an error.
- `getCheckpointContext` walks `SQLProblem.lessonCheckpoint → Article → Module → Track`, loads the article's sibling checkpoints ordered by `position`, and calls `resolveCheckpointPosition`. Returns `null` when the problem has no checkpoint — the context bar then renders nothing.

Wire both into `app/practice/[slug]/page.tsx` beside the existing `getProblem` / `getProblemHistory` calls and pass the results to `ProblemClient`.

- [ ] **Step 4: Verify**

Run: `npm run test:problems-panel`
Expected: PASS, 19 tests.

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add actions/workspace.ts lib/workspace/checkpoint-context.ts scripts/test-problems-panel.ts "app/practice/[slug]/page.tsx"
git commit -m "feat(workspace): add problems-panel and checkpoint-context reads"
```

---

### Task 6: WorkspaceLayout and ProblemsPanel

**Files:**
- Create: `components/practice/workspace/WorkspaceLayout.tsx`
- Create: `components/practice/workspace/ProblemsPanel.tsx`
- Modify: `components/practice/ProblemClient.tsx`

**Interfaces:**
- Consumes: `buildPanelGroups`, `PanelProblem`, `getWorkspaceProblemsPanel`.
- Produces:

```tsx
export function WorkspaceLayout(props: {
    problemsPanel: React.ReactNode
    contextBar: React.ReactNode | null
    problemPanel: React.ReactNode
    editor: React.ReactNode
    panelOpen: boolean
    onTogglePanel: () => void
}): JSX.Element

export function ProblemsPanel(props: {
    problems: PanelProblem[]
    currentSlug: string
    onClose: () => void
}): JSX.Element
```

- [ ] **Step 1: Build the layout shell**

`WorkspaceLayout` renders a `flex h-full min-h-0` row at `lg`+: problems panel `w-[296px] shrink-0`, problem panel `w-[400px] shrink-0`, editor `flex-1 min-w-0`. Each column is `min-h-0 overflow-y-auto` so it scrolls independently and the page does not. The context bar spans the problem panel + editor columns above both.

Below `1280px` (`max-xl`) the problems panel leaves the flow and renders as an overlay drawer: fixed, `w-[296px]`, above the workspace, with a scrim that closes on click and on `Escape`. Below `lg` the whole thing stacks vertically and scrolls with the page, matching today's behaviour — mobile is SP6.

- [ ] **Step 2: Build ProblemsPanel**

Per screen `09`: header "All problems" + count + a `panel-left-close` lucide icon; a filter input; mono chips for Track order / Todo / Tags bound to `PanelMode`; then `buildPanelGroups` output — a mono group header with its `n/m` fraction, and rows on `grid 16px 34px 1fr 14px` (state icon, mono number, 13px title, single-letter difficulty in its colour). The current problem's row takes `primary-row`.

Filter state and mode are local to `ProblemsPanel`; only `panelOpen` lives above it.

- [ ] **Step 3: Move state into ProblemClient**

Add to `ProblemClient`:

```tsx
const PANEL_KEY = "dl:problems-panel"
const [panelOpen, setPanelOpen] = useState(true)

useEffect(() => {
    setPanelOpen(localStorage.getItem(PANEL_KEY) !== "closed")
}, [])

const togglePanel = useCallback(() => {
    setPanelOpen((open) => {
        localStorage.setItem(PANEL_KEY, open ? "closed" : "open")
        return !open
    })
}, [])
```

Default open on a first-ever visit; the read happens in an effect so SSR and first client render agree.

- [ ] **Step 4: Verify**

Run: `npm run build`
Expected: exit 0. (Never bare `next build`.)

Run: `npm run test:e2e -- sql-engine`
Expected: PASS — the existing suite is the regression guard for testids and localStorage keys.

- [ ] **Step 5: Commit**

```bash
git add components/practice/workspace/ components/practice/ProblemClient.tsx
git commit -m "feat(workspace): add the four-column layout and problems panel"
```

---

### Task 7: LessonContextBar

**Files:**
- Create: `components/practice/workspace/LessonContextBar.tsx`

**Interfaces:**
- Consumes: `CheckpointContext` from Task 5.
- Produces: `<LessonContextBar context={CheckpointContext} onOpenPanel={() => void} panelOpen={boolean} />`

- [ ] **Step 1: Build it**

On `#0C1512` (`bg-primary/5` token equivalent — check `globals.css` for the existing name rather than inventing one): "← Back to lesson" in `primary` linking to `/learn/tracks/<trackSlug>/<lessonSlug>`; a mono module/lesson breadcrumb built as `String(modulePosition).padStart(2,"0")` + module title + `/` + lesson title; "Checkpoint {index} of {total}"; and a stepper of `total` bars at 22×5px, the first `index` filled with `primary`.

When `panelOpen` is false the bar gains a `primary`-outlined "All problems" button with a `panel-left-open` icon, per screen `10`.

Renders nothing when `context` is `null`.

- [ ] **Step 2: Verify the token exists**

Run: `npm run check:theme-utilities && npm run check:token-parity`
Expected: both exit 0. If the guard names a class you invented, add the token to **both** `:root` and `.light` plus `@theme inline` — light is not an inversion and a missing light value fails silently for half the users.

- [ ] **Step 3: Commit**

```bash
git add components/practice/workspace/LessonContextBar.tsx
git commit -m "feat(workspace): add the lesson context bar"
```

---

### Task 8: Split ProblemPanel into tabs

**Files:**
- Create: `components/practice/workspace/ProblemTabs.tsx`
- Create: `components/practice/workspace/tabs/DescriptionTab.tsx`, `HintsTab.tsx`, `HistoryTab.tsx`
- Create: `components/practice/workspace/CollapsibleSection.tsx`
- Delete: `components/practice/ProblemPanel.tsx`

**Interfaces:**
- Consumes: `TableInfo` (currently exported from `ProblemPanel.tsx` — **move the type to `lib/workspace/types.ts`** and update `ProblemClient`'s import, since the file it lives in is being deleted).
- Produces: `ProblemTabs` taking `activeTab: "description" | "hints" | "solutions" | "discussion" | "history"` and `onTabChange`.

- [ ] **Step 1: Move the type first**

`ProblemClient.tsx:9` imports `TableInfo` from `ProblemPanel`. Move it to `lib/workspace/types.ts`, re-export nothing, update every import. Do this as its own commit so the deletion in step 3 is mechanical.

Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 2: Build CollapsibleSection and the first-visit rule**

```tsx
export function CollapsibleSection(props: {
    label: string          // "SCHEMA"
    meta?: string          // "2 tables"
    action?: React.ReactNode  // "Preview rows"
    defaultOpen: boolean
    children: React.ReactNode
}): JSX.Element
```

`defaultOpen` comes from one flag in `ProblemClient`:

```tsx
const SEEN_PREFIX = "dl:seen:"
const [firstVisit, setFirstVisit] = useState(false)

useEffect(() => {
    const key = `${SEEN_PREFIX}${slug}`
    setFirstVisit(localStorage.getItem(key) === null)
    localStorage.setItem(key, "1")
}, [slug])
```

Read before write, so the first render of a first visit still sees it absent.

- [ ] **Step 3: Port the tabs**

`DescriptionTab` absorbs today's inline `DescriptionTab` + `SchemaOverview`: mono `#{number}.` + title; chips for difficulty, Solved, tags; body at 14px/1.7; then `SCHEMA` and `EXPECTED OUTPUT` as `CollapsibleSection`s; then the "Comes from" card when `CheckpointContext` is non-null. **Schema stays inline — there is no Schema tab.**

`HintsTab` ports the existing progressive reveal *and its per-hint voting*, adding the preamble: revealing a hint changes nothing about verdict, streak or progress. Keep "All hints revealed." when exhausted.

`HistoryTab` wraps the existing `HistoryPanel` unchanged — including "load this code into editor" and "share approach".

- [ ] **Step 4: Verify**

Run: `npm run build && npm run test:e2e -- sql-engine`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/practice/workspace/ lib/workspace/types.ts
git rm components/practice/ProblemPanel.tsx
git commit -m "refactor(workspace): split ProblemPanel into per-tab files"
```

---

### Task 9: Solutions and Discussion tabs

**Files:**
- Create: `components/practice/workspace/tabs/SolutionsTab.tsx`, `DiscussionTab.tsx`
- Modify: `components/practice/SolutionPanel.tsx` — lift its reveal state to the tab

**Interfaces:**
- Consumes: `getProblemSolution` (`actions/solutions.ts`), `DiscussionPanel`, `DiscussionMode`.
- Produces: `SolutionsTab` and `DiscussionTab`, both taking `{ slug, isSignedIn, isSolved, discussionMode }`.

- [ ] **Step 1: Promote SolutionPanel**

> **Blocker check before starting this task.** The header's `sparkles` mark uses `--accent-violet`, whose **light value is unconfirmed** — `#6D28D9` was proposed but never signed off (handoff follow-up 5, nominally SP7's). Confirm it and add it to `:root`, `.light` **and** `@theme inline` before building this tab, or screen `19` cannot ship. `npm run check:theme-utilities` from Task 3 will fail loudly if you skip it, which is the intended behaviour.

Move `SolutionPanel` out from under the verdict into `SolutionsTab`. **The gating does not change**: reveal only after an accepted submission, only on a deliberate button, sign-in nudge for anonymous viewers, and the footer note verbatim — *"There are many valid solutions — this is the one we publish. Compare against yours to spot patterns, not to match exactly."* Header gains the `sparkles` lucide mark in `accent-violet` and the dialect toggle.

`solutionRevealed` and `solutionDialect` lift from `SolutionPanel` to the tab so the reveal survives tab switches.

- [ ] **Step 2: Port Discussion**

`DiscussionTab` wraps the existing `DiscussionPanel`: Top/New sort, composer, one level of replies, "Showing 2 of 5 replies." truncation, ghost Reply/Report, and the LOCKED banner replacing the composer while the thread stays readable. `HIDDEN` hides the tab entirely, as today.

The "Share my accepted query" shortcut keeps its current behaviour in this phase — prefilling the composer. Task 19 rewires it to post a real approach.

- [ ] **Step 3: Verify**

Run: `npm run build`
Expected: exit 0. Manually confirm the reveal is still gated: sign out, open a solved problem, and check you get the nudge rather than the SQL.

- [ ] **Step 4: Commit**

```bash
git add components/practice/workspace/tabs/ components/practice/SolutionPanel.tsx
git commit -m "feat(workspace): promote solutions and discussion to tabs"
```

---

### Task 10: Split SqlPlayground; add the Runs tab

**Files:**
- Create: `components/practice/workspace/EditorPane.tsx`, `ResultsPane.tsx`, `ActionBar.tsx`
- Delete: `components/sql/SqlPlayground.tsx`

**Interfaces:**
- Consumes: `SqlEditor`, `ResultTable`, `ValidationResult`, `computeValidateRowCap`.
- Produces: `ResultsPane` with `activeTab: "results" | "verdict" | "runs"`.

- [ ] **Step 1: Carry the testids across**

`data-testid="workspace-run-editor"` moves to `EditorPane`, `workspace-run-footer` to `ActionBar`. `tests/e2e/sql-engine.spec.ts` asserts both; if either disappears the suite fails, which is the point.

- [ ] **Step 2: Build the panes**

`EditorPane`: toolbar with a **segmented** DuckDB/Postgres control (replacing today's single flip button — keep it writing `dl:dialect:<slug>`), the engine-ready dot, "draft saved", then Monaco on `grid 40px 1fr` with the gutter.

`ResultsPane`: mono tabs `Results / Verdict / Runs` with a right-aligned `{n} rows · {ms} ms`. Results and Verdict wrap today's `ResultTable` and `ValidationResult` unchanged — **including the truncation warning and the timeout-recovery path**. The accepted verdict renders as a `primary`-bordered row; when a `CheckpointContext` exists it also reports the curriculum consequence ("+1 checkpoint · module 4 now 25%"), recomputing that module's rollup after acceptance.

**Runs** is new and client-only: the last 10 runs of this session — query, row count, elapsed. Never persisted, never sent to the server. It is not the submission history; that is the panel's History tab.

`ActionBar`: Run (`⌘↵`) and Submit (`⌘⇧↵`) with the existing copy *"Run executes locally · Submit records the attempt."*, and a `primary`-tinted "Next checkpoint" pushed right. That button uses `CheckpointContext.nextProblemSlug`; when it is `null` the button reads "Back to lesson" and links to the reader; when there is no checkpoint at all, no button renders.

**`submissionDisabledReason` still disables Submit** — this is the contest lock, and it has no design representation.

- [ ] **Step 3: Verify**

Run: `npm run test:e2e -- sql-engine`
Expected: PASS — all four tests, including the Postgres-survives-reload one.

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add components/practice/workspace/
git rm components/sql/SqlPlayground.tsx
git commit -m "refactor(workspace): split the playground into editor, results and action panes"
```

---

### Task 11: Capability inventory and e2e

**Files:**
- Create: `tests/e2e/workspace.spec.ts`
- Modify: `docs/superpowers/plans/2026-08-11-sp5-workspace.md` — tick the inventory table

**Interfaces:**
- Consumes: everything built in phase 2.
- Produces: the regression suite phases 3 and 4 build on.

- [ ] **Step 1: Write the e2e suite**

```ts
import { test, expect } from "@playwright/test"

const SLUG = "second-highest-salary"   // confirm against prisma/seed.ts

test.describe("workspace", () => {
    test("problems panel toggle survives a reload", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/practice/${SLUG}`)
        await page.getByRole("button", { name: /close problems/i }).click()
        await expect(page.getByRole("complementary", { name: /all problems/i })).toBeHidden()
        await page.reload()
        await expect(page.getByRole("complementary", { name: /all problems/i })).toBeHidden()
    })

    test("schema is open on a first visit and collapsed on the next", async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 })
        await page.goto(`/practice/${SLUG}`)
        await expect(page.getByRole("region", { name: /schema/i })).toBeVisible()
        await page.reload()
        await expect(page.getByRole("region", { name: /schema/i })).toBeHidden()
    })

    test("run and submit shortcuts still fire", async ({ page }) => {
        await page.goto(`/practice/${SLUG}`)
        await page.locator(".monaco-editor").click()
        await page.keyboard.type("SELECT 1;")
        await page.keyboard.press("Meta+Enter")
        await expect(page.getByTestId("workspace-run-footer")).toBeVisible()
    })
})
```

Playwright runs the whole suite under `npm run test:e2e`, which is already in CI — no workflow line needed for this file.

- [ ] **Step 2: Walk the capability inventory**

Open the table at the top of this plan. For **each** row, exercise it in a running dev server and tick it. This is the SP2 failure shape and per-task review does not catch it — the contest lock and the DuckDB introspection fallback in particular are invisible unless you deliberately go looking.

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run dev`

- [ ] **Step 3: Check the light theme**

Both themes ship and **light is not an inversion** — a missing light value fails silently and only for users on that theme. Toggle to light and compare against screenshot `19-light-workspace.png` in the design bundle: the problems panel, the context bar, the collapsible headers, the results pane and the editor gutter. `check:token-parity` proves a token *exists* in `.light`; only your eyes prove it is the *right value*. That distinction is the handoff's pattern 3.

- [ ] **Step 4: Full verification**

```bash
npm run test:console-nav && npm run test:problems-panel && npm run test:lesson-nav \
  && npm run test:reading-progress && npm run test:scroll-restoration \
  && npm run check:token-parity && npm run check:theme-utilities \
  && npx tsc --noEmit && npm run build && npm run test:e2e
```
Expected: exit 0 throughout. Report the actual counts, not "all green".

- [ ] **Step 5: Commit and open the phase 2 PR**

```bash
git add tests/e2e/workspace.spec.ts docs/superpowers/plans/2026-08-11-sp5-workspace.md
git commit -m "test(workspace): cover panel persistence, collapsibles and shortcuts"
gh pr create --base main --title "feat(workspace): rebuild the workspace as a four-column console view"
```

The PR body must list the capability inventory with its verification state, and state plainly that pass rate and community approaches are not in this PR.

---

## Phase 3 — Pass rate

PR title: `feat(workspace): show per-problem pass rate`

## File Structure

- Create: `lib/workspace/pass-rate.ts` — formatting + zero guard. Pure.
- Create: `scripts/test-pass-rate.ts`
- Create: `scripts/verify-pass-rate-backfill.ts`
- Modify: `prisma/schema.prisma`, `actions/submissions.ts:114-140`
- Modify: `actions/problems.ts`, `actions/profile.ts`, `actions/lists.ts`, admin routes — `select` audit

---

### Task 12: The pass-rate module

**Files:**
- Create: `lib/workspace/pass-rate.ts`
- Test: `scripts/test-pass-rate.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Produces: `formatPassRate(accepted: number, attempts: number): string | null`

- [ ] **Step 1: Write the failing tests**

```ts
// Run: node --import tsx --test scripts/test-pass-rate.ts
import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { formatPassRate } from "../lib/workspace/pass-rate"

describe("formatPassRate", () => {
    it("returns null when nobody has attempted", () => {
        // A brand-new problem must render no chip at all. "0% pass" reads
        // as "nobody can solve this" rather than "nobody has tried".
        assert.equal(formatPassRate(0, 0), null)
    })

    it("returns 0% when there are attempts but no passes", () => {
        assert.equal(formatPassRate(0, 12), "0% pass")
    })

    it("rounds to a whole percent", () => {
        assert.equal(formatPassRate(2, 3), "67% pass")
    })

    it("reports 100% only when every attempt passed", () => {
        assert.equal(formatPassRate(5, 5), "100% pass")
    })

    it("never rounds a non-perfect rate up to 100%", () => {
        // 999/1000 is 99.9% — displaying "100% pass" next to a failed
        // attempt is a bug report waiting to happen.
        assert.equal(formatPassRate(999, 1000), "99% pass")
    })

    it("never rounds a non-zero rate down to 0%", () => {
        assert.equal(formatPassRate(1, 1000), "1% pass")
    })

    it("returns null on incoherent counters rather than throwing", () => {
        assert.equal(formatPassRate(5, 2), null)
    })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --import tsx --test scripts/test-pass-rate.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
/**
 * Pass rate for a problem, or null when there is nothing honest to show.
 *
 * Counts submissions, not people: one learner's ten attempts move it ten
 * times. And validateSubmission refuses anonymous callers, so this measures
 * signed-in attempts only. Both limits are stated in the UI copy.
 */
export function formatPassRate(accepted: number, attempts: number): string | null {
    if (attempts <= 0) return null
    if (accepted < 0 || accepted > attempts) return null
    const raw = (accepted / attempts) * 100
    // Clamp the ends inward so a near-miss never displays as a certainty.
    const pct =
        raw > 0 && raw < 1 ? 1 : raw < 100 && raw > 99 ? 99 : Math.round(raw)
    return `${pct}% pass`
}
```

- [ ] **Step 4: Wire and verify**

`package.json`: `"test:pass-rate": "node --import tsx --test scripts/test-pass-rate.ts",`

`.github/workflows/test.yml`, after `Test problems panel model`:

```yaml
      - name: Test pass rate
        run: npm run test:pass-rate
```

Run: `npm run test:pass-rate`
Expected: PASS, 7 tests, exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/workspace/pass-rate.ts scripts/test-pass-rate.ts package.json .github/workflows/test.yml
git commit -m "feat(workspace): add pass-rate formatting with a zero-attempt guard"
```

---

### Task 13: Migration A and the write path

**Files:**
- Modify: `prisma/schema.prisma` — `SQLProblem`
- Create: `prisma/migrations/<timestamp>_problem_pass_counters/migration.sql`
- Modify: `actions/submissions.ts:114-140`
- Create: `scripts/verify-pass-rate-backfill.ts`

**Interfaces:**
- Produces: `SQLProblem.attemptCount: Int`, `SQLProblem.acceptedCount: Int`, both non-null, defaulting to 0.

- [ ] **Step 1: Add the columns**

```prisma
  attemptCount  Int @default(0)
  acceptedCount Int @default(0)
```

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx prisma migrate dev --name problem_pass_counters`

Then **restart the dev server** — the running process holds the old generated client.

- [ ] **Step 2: Backfill in the migration**

Append to the generated `migration.sql`:

```sql
UPDATE "SQLProblem" p SET
  "attemptCount"  = COALESCE(s.attempts, 0),
  "acceptedCount" = COALESCE(s.accepted, 0)
FROM (
  SELECT "problemId",
         COUNT(*)                                        AS attempts,
         COUNT(*) FILTER (WHERE "status" = 'ACCEPTED')    AS accepted
  FROM "Submission"
  GROUP BY "problemId"
) s
WHERE s."problemId" = p."id";
```

- [ ] **Step 3: Increment in the existing transaction**

In `actions/submissions.ts`, the `prisma.submission.create` at line 116 already runs inside the authed branch and records both outcomes. Wrap the create and the counter update in `prisma.$transaction` so a crash between them cannot skew the rate:

```ts
await prisma.$transaction([
    prisma.submission.create({ /* unchanged */ }),
    prisma.sqlProblem.update({
        where: { id: problem.id },
        data: {
            attemptCount: { increment: 1 },
            acceptedCount: { increment: result.ok ? 1 : 0 },
        },
    }),
])
```

- [ ] **Step 4: Verify the backfill by recomputing it**

Create `scripts/verify-pass-rate-backfill.ts`. It must **recompute the aggregate from `Submission` and compare values**, not merely assert the columns are non-zero — a backfill that double-counts passes the weak check. For every problem where the stored counter differs from the recomputed one, print `slug stored=(a,b) actual=(c,d)` and exit 1.

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx tsx scripts/verify-pass-rate-backfill.ts`
Expected: exit 0, "N problems checked, all counters match".

Then submit once against a local problem — one wrong, one accepted — and re-run it. Expected: still exit 0.

- [ ] **Step 5: Audit the select projections**

Adding columns to `SQLProblem` triggers the CLAUDE.md rule. Check `actions/problems.ts`, `actions/profile.ts`, `actions/submissions.ts`, `actions/lists.ts` and every admin route: any `select` that should now carry the counters, and any that must not (the admin `PATCH` body must keep rejecting them, exactly as it rejects `number`).

Run: `npx tsc --noEmit && npm run test:solutions && npm run test:curriculum-actions`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations actions/ scripts/verify-pass-rate-backfill.ts
git commit -m "feat(db): denormalize per-problem pass counters"
```

---

### Task 14: Surface the chip

**Files:**
- Modify: `components/practice/workspace/tabs/DescriptionTab.tsx`, `ProblemsPanel.tsx`
- Modify: `actions/workspace.ts` — add counters to `PanelProblem`

- [ ] **Step 1: Thread the counters through**

Add `attemptCount` and `acceptedCount` to `PanelProblem` and to `getWorkspaceProblemsPanel`'s select. Render `formatPassRate(...)` right-aligned in the Description tab's chip row; skip the chip entirely when it returns `null`.

- [ ] **Step 2: State the limit in copy**

The chip's `title` attribute reads: *Share of signed-in submissions that were accepted.* Not a tooltip essay — one line that stops the number being read as a per-person figure.

- [ ] **Step 3: Verify**

Run: `npm run test:pass-rate && npm run build && npm run test:e2e -- workspace`
Expected: exit 0.

- [ ] **Step 4: Commit and open the phase 3 PR**

```bash
git add components/practice/workspace/ actions/workspace.ts
git commit -m "feat(workspace): show pass rate on the description tab"
gh pr create --base main --title "feat(workspace): show per-problem pass rate"
```

---

## Phase 4 — Community approaches

PR title: `feat(workspace): add community approaches to the solutions tab`

**Posting is open to any signed-in user** — chosen deliberately over an accepted-only gate. The mitigation is the computed `verified` mark, not a gate. Do not quietly add one.

## File Structure

- Modify: `prisma/schema.prisma` — `DiscussionComment`, new enum
- Create: `prisma/migrations/<timestamp>_discussion_comment_kind/migration.sql`
- Create: `actions/approaches.ts`
- Create: `lib/workspace/approach-sort.ts` — ordering. Pure.
- Create: `scripts/test-approaches.ts` (DB-touching)
- Modify: `components/practice/workspace/tabs/SolutionsTab.tsx`, `DiscussionTab.tsx`

---

### Task 15: Migration B

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_discussion_comment_kind/migration.sql`

**Interfaces:**
- Produces: `DiscussionCommentKind` enum; `DiscussionComment.kind`, `.sql`, `.strategy`.

- [ ] **Step 1: Extend the model**

```prisma
enum DiscussionCommentKind {
  COMMENT
  APPROACH
}
```

On `DiscussionComment`:

```prisma
  kind     DiscussionCommentKind @default(COMMENT)
  sql      String?               @db.Text
  strategy String?
```

Existing rows default to `COMMENT`, so nothing changes for the discussion tab.

- [ ] **Step 2: Add the partial unique index by hand**

A plain `@@unique([problemId, authorId, kind])` would also cap **comments** at one per user per problem. Prisma cannot express a partial index, so append to the generated migration:

```sql
CREATE UNIQUE INDEX "DiscussionComment_one_approach_per_user"
  ON "DiscussionComment" ("problemId", "authorId")
  WHERE "kind" = 'APPROACH';
```

- [ ] **Step 3: Verify it constrains the right thing**

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npx prisma migrate dev --name discussion_comment_kind`

Then, against local Postgres, insert two `COMMENT` rows for one user on one problem (must succeed) and two `APPROACH` rows (the second must fail with `23505`). A migration that silently caps comments is the failure this step exists to catch.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add approach kind to discussion comments"
```

---

### Task 16: Approach actions

**Files:**
- Create: `actions/approaches.ts`, `lib/workspace/approach-sort.ts`
- Test: `scripts/test-approaches.ts`
- Modify: `package.json`, `.github/workflows/test.yml` (**CI line required**)

**Interfaces:**
- Produces:

```ts
export type ApproachView = {
    id: string
    authorName: string
    authorImage: string | null
    sql: string
    strategy: string | null
    score: number
    verified: boolean
    isMine: boolean
    createdAt: Date
}
export async function postApproach(input: { problemSlug: string; sql: string; strategy: string | null }): Promise<{ ok: true } | { ok: false; reason: string }>
export async function editApproach(input: { id: string; sql: string; strategy: string | null }): Promise<{ ok: true } | { ok: false; reason: string }>
export async function deleteApproach(id: string): Promise<{ ok: true } | { ok: false; reason: string }>
export async function getApproaches(problemSlug: string): Promise<ApproachView[]>
```

Every one resolves the session internally. **None takes a `userId` argument** — every export of a `"use server"` module is a client-callable RPC endpoint.

- [ ] **Step 1: Write the sort as a pure function, with tests**

`lib/workspace/approach-sort.ts`:

```ts
export function sortApproaches<T extends { score: number; verified: boolean; createdAt: Date }>(
    approaches: T[],
): T[]
```

Score descending; `verified` first **within** an equal score; oldest first as the final tiebreak so the order is stable across renders. Test all three levels in `scripts/test-approaches.ts`, plus: a verified approach with a lower score still ranks below an unverified one with a higher score — score leads, verification only breaks ties.

- [ ] **Step 2: Write the failing DB tests**

`scripts/test-approaches.ts` follows the pattern in `scripts/test-curriculum-admin.ts` (real local Postgres, seeded fixtures, cleaned up after). Cover:

- posting twice as one user fails on the partial unique index, and the action returns `{ ok: false }` rather than throwing
- the `P2002` catch reads `meta.driverAdapterError.cause.constraint.fields` and strips quotes — assert on the returned reason, since `meta.target` is always `undefined` under `@prisma/adapter-pg`
- two different users may each post one approach to the same problem
- one user may still post **many** `COMMENT` rows on that problem
- `getApproaches` returns only `kind: APPROACH`; the discussion query returns only `kind: COMMENT`. **Both directions** — a leak either way is the bug this discriminator invites
- `verified` is true only when the author has an `ACCEPTED` submission on that problem, and flips to true after the author's submission is accepted without the row being rewritten
- `HIDDEN` status excludes an approach from `getApproaches`
- `ProblemDiscussionState.LOCKED` makes `postApproach` return `{ ok: false }` while `getApproaches` still returns the thread
- `ProblemDiscussionState.HIDDEN` hides approaches **and** comments, while the canonical solution is untouched
- an anonymous caller gets `{ ok: false }`, not a thrown error

- [ ] **Step 3: Implement**

`getApproaches` computes `verified` at read time: one query for which of the authors on screen have an `ACCEPTED` submission on this problem. **Never store it** — it goes stale the moment an author solves the problem after posting.

- [ ] **Step 4: Wire and verify**

`package.json`: `"test:approaches": "node --import tsx --test scripts/test-approaches.ts",`

`.github/workflows/test.yml`, after `Test curriculum actions` (it needs the seeded DB, so it belongs with the other DB suites):

```yaml
      - name: Test approaches
        run: npm run test:approaches
```

Run: `DATABASE_URL='postgresql://anchitgupta@localhost:5432/datalearn' npm run test:approaches`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add actions/approaches.ts lib/workspace/approach-sort.ts scripts/test-approaches.ts package.json .github/workflows/test.yml
git commit -m "feat(workspace): add approach actions with computed verification"
```

---

### Task 17: Voting and moderation

**Files:**
- Modify: the discussion vote route under `app/api/problems/[slug]/discussion/`
- Modify: admin moderation views that list comments

- [ ] **Step 1: Confirm votes already work**

`DiscussionVote` keys on `commentId`, so approaches inherit voting with no schema change. Verify by voting on an approach and asserting `score` moves — do not assume it, since the vote route may filter by `kind` implicitly through its query shape.

- [ ] **Step 2: Make approaches visible to moderation**

Reports and hide/delete already key on the comment id. Confirm the admin list shows approaches, and that a hidden approach disappears from `getApproaches`. If the admin query filters comments in a way that excludes them, widen it — approaches must never be unmoderatable.

- [ ] **Step 3: Verify**

Run: `npm run test:approaches && npm run test:e2e -- discussion`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(workspace): bring approaches into voting and moderation"
```

---

### Task 18: The Solutions tab community list

**Files:**
- Modify: `components/practice/workspace/tabs/SolutionsTab.tsx`

- [ ] **Step 1: Render the list**

Below the canonical `SolutionPanel`: approaches in `sortApproaches` order, each with avatar, author, a strategy chip, the SQL, and a vote column (chevron / score / chevron).

**Verified marks are the whole mitigation for the open posting gate:**
- verified approaches carry a check mark with an accessible label, not colour alone
- unverified ones carry the line *not verified against the expected output*
- the canonical solution stays above the list — the editorial answer is never below user content

- [ ] **Step 2: The composer**

Any signed-in user may post. Anonymous viewers get the sign-in nudge. `LOCKED` replaces the composer with the banner and leaves the list readable. A user who already has an approach sees edit/delete instead of a second composer, since the partial unique index will reject one anyway.

- [ ] **Step 3: Verify**

Run: `npm run build && npm run check:theme-utilities`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git commit -am "feat(workspace): list community approaches in the solutions tab"
```

---

### Task 19: Rewire shareApproach

**Files:**
- Modify: `components/practice/ProblemClient.tsx:229-233`, `HistoryPanel.tsx`
- Modify: `tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Replace the prefill**

Today `shareApproach` sets `discussionPrefill` to a fenced `sql` block. Point it at `postApproach` instead: it opens the Solutions composer with the SQL filled in, so "share approach" from the history panel produces a real approach rather than a comment that happens to quote SQL.

Keep `discussionPrefill` for the discussion composer's own "share my accepted query" shortcut — the two shortcuts now land in different places, which is the point.

- [ ] **Step 2: Extend the e2e**

Add: sign in, submit an accepted query, click "share approach" from History, confirm the Solutions composer opens prefilled, post, and confirm the approach appears in the list **with** the verified mark — the author has just had a submission accepted, so this exercises the computed path end to end.

- [ ] **Step 3: Full verification**

```bash
npm run test:console-nav && npm run test:problems-panel && npm run test:pass-rate \
  && npm run test:approaches && npm run test:lesson-nav && npm run test:reading-progress \
  && npm run test:scroll-restoration && npm run check:token-parity \
  && npm run check:theme-utilities && npx tsc --noEmit && npm run build && npm run test:e2e
```
Expected: exit 0 throughout. Report actual counts.

- [ ] **Step 4: Commit and open the phase 4 PR**

```bash
git commit -am "feat(workspace): post approaches from the history panel"
gh pr create --base main --title "feat(workspace): add community approaches to the solutions tab"
```

---

## Done means

- All four PRs merged to `main` with `--base main`.
- Six new suites in `.github/workflows/test.yml`: `test:problems-panel`, `test:pass-rate`, `test:approaches`, `check:theme-utilities`, plus the two Playwright files under the existing `test:e2e` step.
- Every row of the capability inventory verified by hand at the end of phase 2.
- `docs/ROADMAP.md` updated — and while you are there, SP2 still has no entry (handoff follow-up 10).
- The spec's three open questions either confirmed or explicitly carried forward into the SP5 handoff.
