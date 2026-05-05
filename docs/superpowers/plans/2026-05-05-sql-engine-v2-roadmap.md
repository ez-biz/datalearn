# SQL Engine v2 Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sequence the SQL Engine v2 work into reviewable PRs that improve safety, correctness, startup speed, validator robustness, learner UX, and future dialect support.

**Architecture:** Keep `lib/sql-engine/` as the execution boundary. Add runtime controls, authoring gates, caching/warm-up helpers, validator options, and Monaco/schema UX in separate PRs so each release can be tested independently.

**Tech Stack:** Next.js 16 App Router, React client components, DuckDB-WASM, PGlite, Prisma 7, Playwright, GitHub Actions, Monaco, Node test scripts.

---

## Execution Order

| Order | Phase | Primary Outcome | Merge Risk |
|---:|---|---|---|
| 0 | Foundation | Current branch: session boundary + normalization | Low |
| 1 | Runtime safety | Timeout/cancel/reset + result caps | Medium |
| 2 | Authoring correctness | CI audit + publish-time cross-dialect gate | Medium |
| 3 | Startup responsiveness | Warm-up, persistence, caching investigation | Medium-high |
| 4 | Validator robustness | Explicit per-problem validation options | Medium |
| 5 | Workspace UX | Monaco completions, tooltips, better errors | Medium |
| 6 | More dialects | SQLite executable mode; syntax-only modes later | High |

Do not start Phase 6 before Phase 2 is merged.

---

## Phase 1: Runtime Safety

### PR 1.1: Query Timeout, Cancel, and Reset

**Goal:** A runaway learner query should not lock the tab indefinitely.

**Files:**
- Modify: `lib/sql-engine/types.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Create: `lib/sql-engine/runtime-controls.ts`
- Modify: `lib/use-problem-db.ts`
- Modify: `components/sql/SqlPlayground.tsx`
- Test: `scripts/test-sql-engine-runtime-controls.mjs`

**Design:**
- Add `cancel(): Promise<void>` and `reset(): Promise<void>` to `SqlEngineSession`.
- Add a default query timeout, initially `10_000ms`.
- DuckDB path should use cancellable query APIs where available; if cancellation is not reliable, close and recreate the session.
- PGlite path should close and recreate the session after timeout if cancellation is not available.
- UI should show "Query timed out. The engine session was reset." when timeout recovery happens.

**Verification:**
- Unit test `runWithTimeout()` with a never-resolving promise.
- Playwright test a synthetic slow query if a deterministic query is available.
- Run `npm run build`, `npm run lint`, and `npm run test:e2e`.

### PR 1.2: Result Row Cap

**Goal:** Prevent accidental huge result sets from freezing `ResultTable`.

**Files:**
- Modify: `lib/sql-engine/browser-session.ts`
- Modify: `components/sql/ResultTable.tsx`
- Modify: `components/sql/SqlPlayground.tsx`
- Test: `scripts/test-sql-engine-result-cap.mjs`

**Design:**
- Cap displayed/returned rows at a conservative default such as `1_000`.
- Return metadata from `runQuery`, not only rows: `{ rows, rowCount, truncated }`.
- Keep `validateSubmission` using the capped rows until hidden/server validation exists; learners should solve with expected output-sized result sets.
- Render a warning when results are truncated.

**Verification:**
- Unit test row truncation.
- E2E: query a generated schema with >1,000 rows and confirm warning appears.

---

## Phase 2: Authoring Correctness

### PR 2.1: Dialect Audit in CI

**Goal:** Prevent broken published problem/dialect pairs from merging.

**Files:**
- Modify: `.github/workflows/test.yml` or the current PR-check workflow
- Modify: `scripts/audit-all-dialects.ts`
- Modify: `package.json`
- Possibly modify: `prisma/seed.ts`

**Design:**
- Add a script alias that does not rely on global binaries: `node --import tsx scripts/audit-all-dialects.ts` or keep `tsx` after confirming CI installs dev dependencies reliably.
- Run against the CI Postgres service and seeded test data.
- Fail the workflow if any published `(problem, dialect)` pair fails.

**Verification:**
- Local: `npm run audit:dialects`.
- CI: required check must show audit output and fail on an intentionally broken branch during testing.

### PR 2.2: Static Solution Dialect Lint

**Goal:** Catch dialect-specific syntax when a problem claims it is portable.

**Files:**
- Create: `lib/sql-engine/solution-lint.ts`
- Create: `scripts/test-solution-lint.mjs`
- Modify: `lib/admin-validation.ts`
- Modify: `app/api/admin/problems/route.ts`
- Modify: `app/api/admin/problems/[slug]/route.ts`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- Flag patterns such as `::`, `JSONB`, `STRING_AGG`, `LIST_AGG`, `QUALIFY`, dialect-specific date arithmetic, and engine-specific functions.
- Warnings are allowed for DRAFT.
- PUBLISHED should reject when the problem lists multiple dialects and a solution has a known incompatible token unless the solution map is explicitly per-dialect.

**Verification:**
- Unit tests for portable and non-portable SQL examples.
- API tests for create/update PUBLISHED rejection.

### PR 2.3: Admin Capture Diff

**Goal:** When authors run and capture expected output, show what changed against stored rows.

**Files:**
- Modify: `components/admin/ProblemForm.tsx`
- Create: `components/admin/ExpectedOutputDiff.tsx`
- Use existing: `lib/sql-validator.ts`

**Design:**
- On capture, compare newly captured rows to `expectedOutputs[dialect]`.
- Show row-count mismatch, column mismatch, and first differing row.
- Let admin choose "Replace expected output" explicitly.

**Verification:**
- Component-level behavior through Playwright admin flow.
- Unit test diff helper if one is extracted.

### PR 2.4: Publish-Time Cross-Dialect Gate

**Goal:** Reject PUBLISHED status if any listed dialect fails its own solution/output pair.

**Files:**
- Create: `lib/sql-engine/admin-audit.ts`
- Modify: `app/api/admin/problems/route.ts`
- Modify: `app/api/admin/problems/[slug]/route.ts`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- On transition to PUBLISHED, run every listed dialect's canonical solution against schema SQL.
- Compare against `expectedOutputs[dialect]`.
- Return structured per-dialect failures to the admin UI.
- Keep DRAFT/BETA/ARCHIVED permissive.

**Verification:**
- API test: broken POSTGRES output rejects publish.
- API test: DRAFT with partial outputs remains allowed.
- E2E: admin sees failure list.

---

## Phase 3: Startup Responsiveness

### PR 3.1: Engine Warm-Up

**Goal:** Start loading the likely engine before the learner reaches the workspace.

**Files:**
- Create: `lib/sql-engine/warmup.ts`
- Modify: `app/page.tsx`
- Modify: `components/practice/PracticeList.tsx`
- Modify: `lib/sql-engine/browser-session.ts`

**Design:**
- Add `warmSqlEngine(dialect)` that imports the selected engine initializer without creating schema state.
- Warm DuckDB on home/practice hover or when the practice list is visible.
- Do not warm PGlite unless a problem advertises Postgres or the user previously selected it.
- Store last dialect in localStorage and warm that dialect first.

**Verification:**
- E2E checks no UI regression.
- Manual browser timing: first workspace engine ready before/after.

### PR 3.2: PGlite IndexedDB Persistence

**Goal:** Avoid replaying the same schema for Postgres problems repeatedly.

**Files:**
- Modify: `lib/pglite.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Create: `lib/sql-engine/schema-cache-key.ts`
- Test: `scripts/test-schema-cache-key.mjs`

**Design:**
- Create a stable schema hash key from schema SQL and problem slug.
- Initialize PGlite with an IndexedDB-backed data directory.
- Track schema version in a small metadata table; replay schema only when hash changes.
- Keep memory-only mode available for tests and private browsing fallback.

**Verification:**
- Unit test stable hash generation.
- Browser E2E: reload same Postgres problem and confirm query still works.
- Manual timing comparison.

### PR 3.3: Service Worker / Asset Precache Investigation

**Goal:** Cache WASM assets without creating sticky broken deploys.

**Files:**
- Create: `docs/superpowers/specs/2026-05-xx-sql-engine-asset-caching-design.md`
- Possibly create: `public/sw.js`
- Possibly create: `components/layout/ServiceWorkerRegistration.tsx`

**Design:**
- First document whether DuckDB jsDelivr WASM/worker URLs can be safely precached under current CORS/cache headers.
- Prefer browser cache warming via `fetch()` before adding a full service worker.
- If using a service worker, version cache names and provide an emergency unregister path.

**Verification:**
- Lighthouse/application cache inspection in browser.
- Confirm deploy update does not keep stale engine assets.

### PR 3.4: DuckDB Minimal Bundle Investigation

**Goal:** Reduce the ~30MB cold download if DuckDB's package supports a smaller browser bundle.

**Files:**
- Create: `docs/superpowers/specs/2026-05-xx-duckdb-bundle-size-investigation.md`
- Possibly modify: `lib/duckdb.ts`

**Design:**
- Measure current DuckDB asset download sizes.
- Test available bundles from `@duckdb/duckdb-wasm`.
- Only switch if the smaller bundle supports current problem SQL and passes dialect audit.

**Verification:**
- `npm run audit:dialects`.
- Browser network screenshot or saved measurement table.

---

## Phase 4: Validator Robustness

### PR 4.1: Validation Options Model

**Goal:** Make drift handling explicit per problem instead of hidden inside global validator behavior.

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration: `prisma/migrations/*_add_problem_validation_options/`
- Modify: `lib/sql-validator.ts`
- Modify: `lib/admin-validation.ts`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- Add `validationOptions Json @default("{}")` to `SQLProblem`.
- Supported shape:

```ts
type ProblemValidationOptions = {
    caseInsensitiveStrings?: boolean
    decimalTolerance?: number
    timestampMode?: "instant" | "local-date"
    jsonMode?: "deep" | "string"
}
```

**Verification:**
- Unit tests for default behavior unchanged.
- Unit tests for each option.
- Migration applies locally.

### PR 4.2: JSON and TIMESTAMPTZ Robustness

**Goal:** Make JSON and timezone problems possible without brittle string comparisons.

**Files:**
- Modify: `lib/sql-validator.ts`
- Test: `scripts/test-sql-validator-json-time.mjs`

**Design:**
- Deep-compare object/array JSON values after normalizing key order.
- Normalize timestamp-like values to ISO instants when `timestampMode = "instant"`.
- Preserve existing behavior by default unless options are set.

**Verification:**
- Unit tests with reordered JSON keys.
- Unit tests with equivalent timezone timestamp strings.

---

## Phase 5: Learner Workspace UX

### PR 5.1: Schema-Aware Monaco Completion

**Goal:** Typing table or column names should feel guided.

**Files:**
- Modify: `components/sql/SqlEditor.tsx`
- Modify: `components/sql/SqlPlayground.tsx`
- Modify: `components/practice/ProblemClient.tsx`
- Use existing: `lib/schema-parser.ts`

**Design:**
- Pass parsed `tableInfos` into `SqlEditor`.
- Register a Monaco completion provider for SQL identifiers.
- Suggest table names, column names, and common clauses.
- Keep completion local; no network calls.

**Verification:**
- Playwright: focus editor, type prefix, assert suggestion text appears if Monaco exposes it reliably.
- Manual browser check if Monaco suggestion DOM is unstable.

### PR 5.2: Friendly SQL Errors

**Goal:** Translate common engine errors into learner-friendly hints.

**Files:**
- Create: `lib/sql-engine/errors.ts`
- Test: `scripts/test-sql-engine-errors.mjs`
- Modify: `lib/sql-engine/browser-session.ts`
- Modify: `components/sql/ValidationResult.tsx`

**Design:**
- Parse common raw messages: missing table, missing column, syntax near token, ambiguous column, GROUP BY mismatch.
- Return `{ message, hint, rawMessage }`.
- Keep raw message available behind a disclosure.

**Verification:**
- Unit tests for representative DuckDB and PGlite messages.
- E2E: bad query shows friendly hint.

### PR 5.3: Column-Type Tooltips

**Goal:** Let learners inspect column types without leaving the editor/workspace flow.

**Files:**
- Modify: `components/practice/ProblemPanel.tsx`
- Modify: `components/sql/SqlEditor.tsx`

**Design:**
- Use parsed schema data to show type hints in schema panel hover states first.
- Add editor hover provider after schema panel tooltips are stable.

**Verification:**
- E2E: schema panel tooltip appears.
- Manual Monaco hover check.

### PR 5.4: Attempt History Diff

**Goal:** Help learners understand what changed between attempts.

**Files:**
- Modify: `components/practice/HistoryPanel.tsx`
- Create: `components/practice/SubmissionDiff.tsx`

**Design:**
- Let user select two attempts from local history.
- Show SQL text diff with accepted/wrong status metadata.
- No backend changes; use already loaded submission history.

**Verification:**
- E2E: two submitted attempts can be compared.

### PR 5.5: Query Plan Visualization

**Goal:** Make advanced SQL performance concepts teachable.

**Files:**
- Create: `lib/sql-engine/explain.ts`
- Create: `components/sql/QueryPlanTree.tsx`
- Modify: `components/sql/SqlPlayground.tsx`

**Design:**
- Start with DuckDB `EXPLAIN` text rendering.
- Add tree rendering only after stable parser output exists.
- Gate behind an "Explain" button, not automatic run.

**Verification:**
- E2E: Explain renders output for a simple query.

---

## Phase 6: More Dialects

### PR 6.1: SQLite via `sql.js`

**Goal:** Add one executable third dialect with a mature browser runtime.

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration: `prisma/migrations/*_add_sqlite_dialect/`
- Create: `lib/sql-engine/sqlite-session.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Modify: `lib/admin-validation.ts`
- Modify: `components/admin/ProblemForm.tsx`
- Modify: `components/sql/SqlEditor.tsx`

**Design:**
- Add `SQLITE` to the `Dialect` enum.
- Require per-dialect `solutions.SQLITE` and `expectedOutputs.SQLITE` for PUBLISHED SQLite problems.
- Do not auto-enable SQLite for existing problems.

**Verification:**
- Unit tests for admin validation.
- Audit script includes SQLite.
- E2E can solve a SQLite-only problem.

### PR 6.2: Syntax-Only Dialect Mode

**Goal:** Support interview-prep dialects honestly when execution is not available.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `components/sql/SqlPlayground.tsx`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- Add a separate problem mode, not a fake executable dialect.
- Syntax-only problems store reference solution and rubric, not expected output.
- Submit becomes "Mark reviewed" or "Compare to reference", not accepted/wrong-answer validation.

**Verification:**
- E2E: syntax-only problem cannot claim automatic validation.

---

## Parking Lot

- MySQL remains parked until a production-grade WASM runtime or a deliberate server-side sandbox exists.
- Server-side runner remains separate from SQL Engine v2 browser work.
- Hidden test cases should wait until server-side execution or a stronger client-side anti-cheat story exists.
