# SQL Engine v2 Roadmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sequence the SQL Engine v2 work into reviewable PRs that improve safety, correctness, startup speed, validator robustness, learner UX, and future dialect support.

**Architecture:** Keep `lib/sql-engine/` as the execution boundary. Add runtime controls, authoring gates, caching/warm-up helpers, validator options, and Monaco/schema UX in separate PRs so each release can be tested independently.

**Tech Stack:** Next.js 16 App Router, React client components, DuckDB-WASM, PGlite, Prisma 7, Playwright, GitHub Actions, Monaco, Node test scripts.

---

## Execution Order

| Order | PR | Primary Outcome | Merge Risk |
|---:|---|---|---|
| 0 | Foundation (shipped) | Session boundary + normalization | Low |
| 1 | PR 1.1 (shipped) | Dialect audit in CI | Low |
| 2 | PR 1.2 (implemented) | Result row cap with display/validate split | Low |
| 3 | PR 1.3 (implemented) | Query timeout, cancel, reset | Medium |
| 4 | PR 1.4 (implemented) | JSON + TIMESTAMPTZ validator robustness | Low |
| 5 | PR 1.5 | Read-only guard tokenizer (optional) | Low |
| 6 | PR 1.6 | Engine timing telemetry harness | Low |
| 7 | Phase 2 | Authoring correctness (lint, capture diff, publish gate) | Medium |
| 8 | Phase 3 | Startup responsiveness (warm-up, persistence, caching) | Medium-high |
| 9 | Phase 4 | Per-problem validation options + legacy column drop | Medium |
| 10 | Phase 5 | Workspace UX (Monaco completions, errors, diff, plan) | Medium |
| 11 | Phase 6 | More dialects (SQLite first, syntax-only later) | High |

Phase 6 must not start before Phase 2 is merged.

---

## Phase 1: Safety, Correctness & Measurement Foundations

Phase 1 protects every later phase. Authoring gates (1.1) and validator correctness fixes (1.4) catch regressions introduced by the runtime and startup work that follows. Telemetry (1.6) makes Phase 3's "before/after" claims verifiable.

### PR 1.1: Dialect Audit in CI

**Status:** Implemented in `feat/sql-engine-v2-foundation`.

**Goal:** Prevent broken published `(problem, dialect)` pairs from merging.

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `scripts/audit-all-dialects.ts`
- Modify: `package.json`
- Possibly modify: `prisma/seed.ts`

**Design:**
- Run problem solutions against **PGlite-Node + DuckDB-Node** (same local engines the script uses). The existing CI Postgres service remains only the metadata/content store that Prisma seeds and reads from.
- Add `npm run audit:dialects:ci` and run it in `.github/workflows/test.yml` immediately after migrations and seed.
- Extract `lib/sql-engine/dialect-audit.ts` so missing solution SQL, missing schema SQL, and malformed expected output JSON are resolved consistently and fail the check.
- Seed problems 1-11 include canonical `solutions` / `expectedOutputs` maps so a fresh CI database has no skipped published pairs.
- Required PR check on `main` after one merged green run.
- Report every broken pair with a structured per-dialect failure list.

**Verification:**
- `npm run test:dialect-audit`
- `npx tsc --noEmit`
- `npx tsx prisma/seed.ts`
- `npm run audit:dialects`
- `npm run audit:dialects:ci`
- `npm run lint`
- `npm run build`
- `npm run test:e2e`

### PR 1.2: Result Row Cap (with display/validate split)

**Status:** Implemented in `feat/sql-engine-result-cap`.

**Goal:** Prevent accidental huge result sets from freezing `ResultTable`, without breaking validation for problems whose expected output approaches the cap.

**Files:**
- Modify: `lib/sql-engine/types.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Modify: `components/sql/ResultTable.tsx`
- Modify: `components/sql/SqlPlayground.tsx`
- Modify: `lib/use-problem-db.ts`
- Test: `scripts/test-sql-engine-result-cap.ts`
- Test: `tests/e2e/sql-engine.spec.ts`

**Design:**
- `runQuery` returns `{ rows, rowCount, truncated }` (not bare `Row[]`).
- Two caps, not one:
  - `displayCap` (default `1_000`) — limits what `ResultTable` renders.
  - `validateCap` — computed per problem as `max(2 × expectedOutput.rowCount, 1_000)`. Validation runs against rows up to `validateCap`.
- If a query exceeds `validateCap`, validation returns a structured "result too large" error rather than silently truncating into a wrong-answer.
- Render a warning above the table when `truncated` is true.

**Verification:**
- Unit test row truncation paths and the display/validate split.
- E2E: query a generated schema with >1,000 rows; warning appears, validation behavior matches the spec.

### PR 1.3: Query Timeout, Cancel, and Reset

**Status:** Implemented in `feat/sql-engine-timeout-reset`.

**Goal:** A runaway learner query must not lock the tab.

**Files:**
- Modify: `lib/sql-engine/types.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Create: `lib/sql-engine/runtime-controls.ts`
- Modify: `lib/use-problem-db.ts`
- Modify: `components/sql/SqlPlayground.tsx`
- Test: `scripts/test-sql-engine-runtime-controls.ts`
- Test: `tests/e2e/sql-engine.spec.ts`

**Design:**
- Add `cancel(): Promise<void>` and `reset(): Promise<void>` to `SqlEngineSession`.
- Default query timeout `10_000ms`, configurable per-problem later.
- DuckDB-WASM has no reliable async cancel — fall back to `dispose()` + recreate. PGlite likewise.
- Keep the runtime-controls contract **engine-agnostic** so SQLite (no async cancel either) drops in cleanly in Phase 6 with a recreate-only implementation.
- UI surfaces "Query timed out — engine session was reset" toast and disables Submit during recovery.

**Verification:**
- Unit test `runWithTimeout()` with a never-resolving promise.
- Playwright: deterministic slow aggregate with a test-only timeout override triggers the timeout path, then verifies a simple follow-up query runs after reset.
- `npm run build`, `npm run lint`, `npm run test:e2e`.

### PR 1.4: JSON and TIMESTAMPTZ Validator Robustness

**Status:** Implemented in `feat/sql-validator-json-time`.

**Goal:** Close the JSON-key-ordering and timezone-equivalence gaps in the validator. These are correctness fixes, not opt-in options — they fire unconditionally.

**Files:**
- Modify: `lib/sql-validator.ts`
- Test: `scripts/test-sql-validator-json-time.ts`

**Design:**
- Deep-compare object/array JSON values after normalizing key order.
- Normalize timestamp-like values to ISO instants when comparing — extends the existing `toIsoIfDate()` to cover string TIMESTAMPTZ shapes (`2026-05-05 10:00:00+05:30` ↔ `2026-05-05T04:30:00.000Z`).
- Default behavior preserved for primitives; only JSON-shaped and timestamp-shaped cells take the new path.

**Verification:**
- Unit tests with reordered JSON keys.
- Unit tests with equivalent timezone timestamp strings.
- `npm run audit:dialects` passes against current DB.

### PR 1.5: Read-Only Guard Tokenizer (implemented)

**Goal:** Replace the regex/first-keyword guard in `lib/sql-restrict.ts` with a small tokenizer-based check so adversarial inputs (`;` inside string literals, multi-statement chains hidden in comments, dialect-specific shapes like `COPY ... FROM`) can't slip through.

**Files:**
- Modify: `lib/sql-restrict.ts`
- Modify: `scripts/test-sql-restrict.ts`

**Design:**
- Tokenize on whitespace/operators with awareness of comments, `'…'` string literals, `"…"` quoted identifiers, and Postgres-style dollar-quoted literals.
- Same allow-list and `SqlGuardResult` contract.
- Scan tokenized statements for mutating tokens so CTE-wrapped DML and `EXPLAIN ANALYZE` around DML are rejected without false positives from string data.
- Added adversarial test cases for semicolons in literals, write keywords inside literals/quoted identifiers, `COPY ... FROM STDIN`, multi-statement chains, CTE-wrapped DML, and `EXPLAIN ANALYZE DELETE`.

**Verification:**
- All current `scripts/test-sql-restrict.ts` assertions still pass.
- New adversarial cases pass.

This PR closes the optional hardening slot from the roadmap and ships as part of the SQL Engine v2 foundation work.

### PR 1.6: Engine Timing Telemetry Harness (implemented)

**Goal:** Make Phase 3's "before/after" measurable. Without this, startup work is unfalsifiable.

**Files:**
- Create: `lib/sql-engine/telemetry.ts`
- Create: `app/api/telemetry/sql-engine/route.ts`
- Create: `scripts/test-sql-engine-telemetry.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Modify: `lib/use-problem-db.ts`
- Modify: `components/practice/ProblemClient.tsx`

**Design:**
- Emit timing events: `engine.init.start`, `engine.init.ready`, `engine.firstQuery.ready`, `engine.dispose`.
- Sink: `console.debug` in dev, `navigator.sendBeacon` to `/api/telemetry/sql-engine` in prod (no-op handler initially — just log to stdout). Keep server route trivial; we can wire it to Vercel Analytics later.
- Sampled — opt out via `localStorage.dl:telemetry:off`.
- Strict types so future histograms / percentiles can hang off the same events.
- Payloads include dialect, session id, optional public problem slug, schema statement count, session elapsed ms, and first-query runtime ms. They intentionally do not include learner SQL, schema SQL, result rows, or answer-key data.

**Verification:**
- Unit test event payload shape, opt-out, deterministic sampling, endpoint, and session sink.
- Manual: open workspace, see events in console in development; production builds send beacon payloads to `/api/telemetry/sql-engine`.

---

## Phase 2: Authoring Correctness

CI audit (PR 1.1) is now the floor. Phase 2 adds the publish-time and admin-time gates that complement it.

### PR 2.1: Static Solution Dialect Lint

**Goal:** Catch dialect-specific syntax when a problem claims it is portable.

**Files:**
- Create: `lib/sql-engine/solution-lint.ts`
- Create: `scripts/test-solution-lint.mjs`
- Modify: `lib/admin-validation.ts`
- Modify: `app/api/admin/problems/route.ts`
- Modify: `app/api/admin/problems/[slug]/route.ts`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- Flag patterns: `::` casts, `JSONB`, `STRING_AGG`, `LIST_AGG`, `QUALIFY`, `INTERVAL '…'` shapes, engine-specific date arithmetic.
- DRAFT: warnings only.
- PUBLISHED with multiple `dialects[]` and a non-per-dialect solution: reject when an incompatible token is found.
- Override path: per-dialect `solutions{}` map populated for every listed dialect — explicit author intent overrides the lint.
- UI: inline warnings in `ProblemForm` per dialect, with a "I have per-dialect solutions" hint that links to the per-dialect tab.

**Verification:**
- Unit tests for portable and non-portable SQL examples.
- API tests for create/update PUBLISHED rejection and the override path.

### PR 2.2: Admin Capture Diff

**Goal:** When authors run-and-capture expected output, surface what changed against stored rows.

**Files:**
- Modify: `components/admin/ProblemForm.tsx`
- Create: `components/admin/ExpectedOutputDiff.tsx`
- Use existing: `lib/sql-validator.ts`

**Design:**
- On capture, compare newly captured rows to `expectedOutputs[dialect]`.
- Show row-count delta, column-shape delta, and the first differing row inline.
- "Replace expected output" requires explicit confirmation when the diff is non-empty.

**Verification:**
- Component-level Playwright admin flow.
- Unit test for the diff helper.

### PR 2.3: Publish-Time Cross-Dialect Gate

**Goal:** Reject PUBLISHED status if any listed dialect fails its own solution/output pair, **server-side**.

**Files:**
- Create: `lib/sql-engine/admin-audit.ts`
- Modify: `scripts/audit-all-dialects.ts` (delegate core logic to `admin-audit.ts`)
- Modify: `app/api/admin/problems/route.ts`
- Modify: `app/api/admin/problems/[slug]/route.ts`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- Single source of truth: `lib/sql-engine/admin-audit.ts` exports `auditProblemDialects(problem) → DialectAuditResult[]`. Both the publish-time gate and the CI audit script import from here.
- This enforces "what learners run" == "what authors validate" == "what CI checks."
- Runs server-side (DuckDB-Node + PGlite-Node).
- DRAFT/BETA/ARCHIVED remain permissive.
- Returns structured failures to the admin UI per dialect.

**Verification:**
- API test: broken POSTGRES output rejects publish.
- API test: DRAFT with partial outputs remains allowed.
- Test: CI audit script and publish gate produce identical results for the same input.
- E2E: admin sees failure list.

---

## Phase 3: Startup Responsiveness

Land Phase 1.6 telemetry first so every Phase 3 PR can attach before/after numbers to its description.

### PR 3.1: Engine Warm-Up

**Goal:** Start loading the likely engine before the learner reaches the workspace.

**Files:**
- Create: `lib/sql-engine/warmup.ts`
- Modify: `app/page.tsx`
- Modify: `components/practice/PracticeList.tsx`
- Modify: `lib/sql-engine/browser-session.ts`

**Design:**
- Add `warmSqlEngine(dialect)` that imports the selected engine initializer without creating schema state.
- Bound concurrency: at most **one warm session per dialect**. Subsequent hover events replace, not stack.
- Cancel + dispose any warm session that's been idle for >60s without being claimed.
- Trigger points: practice card hover, practice list mount.
- Warm DuckDB by default; warm PGlite only if last-picked dialect (from `localStorage`) is Postgres or the problem advertises it.

**Verification:**
- E2E: no UI regression.
- Telemetry: `engine.init.ready` fires before the workspace renders for warmed sessions.
- Manual: ten rapid hovers don't spawn ten WASM instances.

### PR 3.2: PGlite IndexedDB Persistence

**Goal:** Avoid replaying the same schema for Postgres problems on every visit.

**Files:**
- Modify: `lib/pglite.ts`
- Modify: `lib/sql-engine/browser-session.ts`
- Create: `lib/sql-engine/schema-cache-key.ts`
- Test: `scripts/test-schema-cache-key.mjs`

**Design:**
- Stable cache key: `sha256(slug + schemaSql + pgliteVersion)`. Including the **PGlite package version** is required — a release can break the on-disk format and a stale cache will surface as runtime errors.
- Initialize PGlite with an IndexedDB-backed data directory.
- Schema-version metadata table tracks the hash; replay only when hash mismatches.
- Memory-only fallback for: tests, private browsing (IndexedDB unavailable), and an emergency `dl:pglite-cache:off` localStorage flag.

**Verification:**
- Unit test: hash stability, hash version-bump invalidation.
- Browser E2E: reload Postgres problem; query still works; second load is faster.
- Telemetry comparison.

### PR 3.3: Service Worker / Asset Precache Investigation

**Goal:** Cache WASM assets without creating sticky broken deploys.

**Files:**
- Create: `docs/superpowers/specs/2026-05-xx-sql-engine-asset-caching-design.md`
- Possibly create: `public/sw.js`
- Possibly create: `components/layout/ServiceWorkerRegistration.tsx`

**Design:**
- Investigation phase first — produce the design doc before touching `public/`.
- Prefer `fetch()` warming into the HTTP cache over a service worker.
- If a service worker is unavoidable:
  - Restrict scope to `/_dl/sql-engine/` (or similar dedicated path) so it cannot intercept Next.js's own asset routes.
  - Version cache names with the build SHA.
  - Ship a `?dl-sw=unregister` query handler that unregisters and clears caches — emergency lever for a stuck deploy.
  - Document the unregister path in `docs/DEPLOY.md`.

**Verification:**
- Lighthouse / Application tab check.
- Confirm a follow-up deploy invalidates stale engine assets.
- Confirm `?dl-sw=unregister` clears state cleanly.

### PR 3.4: DuckDB Minimal Bundle Investigation

**Goal:** Reduce the ~30MB cold download if a smaller browser bundle works.

**Files:**
- Create: `docs/superpowers/specs/2026-05-xx-duckdb-bundle-size-investigation.md`
- Possibly modify: `lib/duckdb.ts`

**Design:**
- Measure current asset sizes (eh / mvp / coi bundles from `@duckdb/duckdb-wasm`).
- Test against `npm run audit:dialects` — only switch if the smaller bundle handles every published DuckDB problem.
- Note for the doc: **DuckDB-WASM has no OPFS persistence story today.** Phase 3 only addresses PGlite repeat-load cost. DuckDB asymmetry is acknowledged and not in scope.

**Verification:**
- `npm run audit:dialects` against the candidate bundle.
- Network panel screenshot or measurement table in the design doc.

---

## Phase 4: Validator Options & Legacy Cleanup

### PR 4.1: Per-Problem Validation Options

**Goal:** Make drift handling explicit per problem instead of hidden inside global validator behavior. Note: JSON-key-ordering and TIMESTAMPTZ normalization already shipped in PR 1.4 as unconditional fixes — Phase 4 only adds **opt-in** options.

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration: `prisma/migrations/*_add_problem_validation_options/`
- Modify: `lib/sql-validator.ts`
- Modify: `lib/admin-validation.ts`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- Add `validationOptions Json @default(dbgenerated("'{}'::jsonb"))` to `SQLProblem`. (Prisma's plain `@default("{}")` has misbehaved on Json columns historically — use `dbgenerated`.)
- Supported shape:

```ts
type ProblemValidationOptions = {
    caseInsensitiveStrings?: boolean
    decimalTolerance?: number
    timestampMode?: "instant" | "local-date"
    jsonMode?: "deep" | "string"  // "deep" defaults from PR 1.4
}
```

**Verification:**
- Unit tests: defaults match PR 1.4 behavior.
- Unit tests: each option toggles correctly.
- Migration applies locally + against Neon preview.

### PR 4.2: Legacy Column Cleanup Release

**Goal:** Drop the deprecated `solutionSql` and `expectedOutput` (singular) columns from `SQLProblem`. Carryover from v0.4.2.

**Files:**
- Modify: `prisma/schema.prisma`
- Add migration: `prisma/migrations/*_drop_legacy_solution_columns/`
- Modify: `actions/problems.ts`, `actions/profile.ts`, `actions/submissions.ts`, `actions/lists.ts`
- Modify: `app/api/admin/problems/route.ts`, `app/api/admin/problems/[slug]/route.ts`
- Modify: `lib/admin-validation.ts` (drop fallback synthesis)
- Modify: `components/admin/ProblemForm.tsx`
- Modify: `mcp-server/src/tools/problems.ts`
- Update: `CLAUDE.md`, `docs/API.md`, `mcp-server/README.md`

**Pre-conditions:**
- All published problems have `solutions{}` and `expectedOutputs{}` populated for every listed dialect (verified by `audit:dialects` PR check).
- One full release cycle has shipped with the new columns as primary.

**Verification:**
- Audit script passes against prod data before the migration.
- Local migration on a `sync-from-prod` snapshot.
- Staging deploy + smoke before merging to `production`.

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
- Register a Monaco completion provider for SQL identifiers (table names, column names, common clauses). Monaco already provides keyword completion for SQL — this layer adds identifiers.
- Local-only; no network calls.

**Verification:**
- Playwright: focus editor, type prefix, assert suggestion text appears.
- Manual browser check if Monaco DOM is unstable.

### PR 5.2: Friendly SQL Errors

**Goal:** Translate common engine errors into learner-friendly hints.

**Files:**
- Create: `lib/sql-engine/errors.ts`
- Test: `scripts/test-sql-engine-errors.mjs`
- Modify: `lib/sql-engine/browser-session.ts`
- Modify: `components/sql/ValidationResult.tsx`

**Design:**
- Parse common raw messages: missing table, missing column, syntax-near-token, ambiguous column, GROUP BY mismatch.
- Return `{ message, hint, rawMessage }`.
- Raw message available behind a disclosure.

**Verification:**
- Unit tests for representative DuckDB and PGlite messages.
- E2E: bad query shows friendly hint.

### PR 5.3: Column-Type Tooltips

**Goal:** Let learners inspect column types without leaving the editor.

**Files:**
- Modify: `components/practice/ProblemPanel.tsx`
- Modify: `components/sql/SqlEditor.tsx`

**Design:**
- Schema-panel hover tooltips first (lower-risk).
- Monaco hover provider only after schema panel is stable.

**Verification:**
- E2E: schema panel tooltip appears.
- Manual Monaco hover check.

### PR 5.4: Attempt History Diff

**Goal:** Help learners understand what changed between attempts.

**Files:**
- Modify: `components/practice/HistoryPanel.tsx`
- Create: `components/practice/SubmissionDiff.tsx`

**Design:**
- Select two attempts from local history; show SQL text diff + accepted/wrong status.
- No backend changes.

**Verification:**
- E2E: two submitted attempts can be compared.

### PR 5.5: Query Plan Visualization

**Goal:** Make advanced SQL performance concepts teachable.

**Files:**
- Create: `lib/sql-engine/explain.ts`
- Create: `components/sql/QueryPlanTree.tsx`
- Modify: `components/sql/SqlPlayground.tsx`

**Design:**
- DuckDB `EXPLAIN` text rendering first.
- Tree rendering only after a stable parser exists.
- Gated behind an "Explain" button.

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
- `sql.js` has **no async cancellation** — runtime-controls (PR 1.3) treats it as recreate-only, the same path PGlite uses.

**Verification:**
- Unit tests for admin validation.
- Audit script + publish gate include SQLite.
- E2E can solve a SQLite-only problem.

### PR 6.2: Syntax-Only Dialect Mode

**Goal:** Support interview-prep dialects honestly when execution is not available.

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `components/sql/SqlPlayground.tsx`
- Modify: `components/admin/ProblemForm.tsx`

**Design:**
- A separate problem mode, not a fake executable dialect.
- Stores reference solution + rubric, not expected output.
- Submit becomes "Mark reviewed" or "Compare to reference" — never accepted/wrong-answer.

**Verification:**
- E2E: syntax-only problem cannot claim automatic validation.

---

## Trust Boundary (forward-looking, not in this plan)

The browser-side validator trusts client-provided `userResult` in `validateSubmission`. A forged POST currently gets marked solved. This is **out of scope for SQL Engine v2** but is the largest correctness gap above the engine layer. Two paths:

1. **Server-side execution** — re-run the learner's SQL on a sandboxed server engine and compare the *server's* rows. Heavy, but the only way to make submissions trustworthy.
2. **Hidden test cases** — server holds a second `expectedOutputs` map the client never sees; submission posts the SQL text, not the rows; server runs it. Same cost as path 1.

Both depend on a server runner that this plan deliberately does not build. Document here so it doesn't get lost; revisit after Phase 4 ships.

---

## Parking Lot

- MySQL — parked until a production-grade WASM runtime or deliberate server-side sandbox.
- Server-side runner — see "Trust Boundary" above.
- Hidden test cases — depends on server-side runner.
- DuckDB OPFS persistence — no upstream story; revisit when DuckDB-WASM publishes one.
