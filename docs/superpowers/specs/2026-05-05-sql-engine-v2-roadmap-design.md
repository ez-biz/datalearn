# SQL Engine v2 Roadmap Design

## Goal

Turn the SQL engine work into a sequence of small PRs that improve reliability, authoring correctness, startup responsiveness, and learner experience without losing the current low-cost browser execution model.

## Current Baseline

Data Learn now has a browser engine session boundary in `lib/sql-engine/`. DuckDB-WASM and PGlite still run client-side, and `useProblemDB` owns only React lifecycle state. This is the right base for the next engine work because future changes can happen behind the same `{ runQuery, dispose }` session contract.

PR 1.1 is also in place on the SQL Engine v2 branch: `.github/workflows/test.yml` runs `npm run audit:dialects:ci` after migrations and seed. The audit resolves each published `(problem, dialect)` pair through `lib/sql-engine/dialect-audit.ts`, executes canonical SQL with DuckDB-Node or PGlite-Node, and fails on missing solution SQL, missing schema SQL, malformed expected output JSON, execution errors, or validator mismatches.

## Product Priorities

1. **Correctness and safety first.** A wrong answer accepted or a correct answer rejected damages trust more than a slow first load.
2. **Fast perceived startup second.** Reduce the 1-3 second cold-start pain after the execution path is safe and cancellable.
3. **Authoring gates before more dialects.** More engines multiply drift; publish-time and CI audits should be stronger before adding SQLite or syntax-only dialects.
4. **Learner UX after the engine boundary is stable.** Monaco autocomplete, tooltips, and friendlier errors are high-impact, but they should consume stable engine/schema APIs.

## Phased Scope

### Phase 1: Safety, Correctness & Measurement Foundations

A consolidated foundation phase that protects every later phase. Combines:

- **Authoring floor:** dialect audit running as a required CI check, so no broken `(problem, dialect)` pair can merge while later phases are in flight.
- **Runtime safety:** query timeout, cancel/reset behavior, row-count caps with a display/validate split that protects validation when expected output approaches the cap.
- **Validator correctness fixes that are unconditional, not opt-in:** JSON-key-ordering equality and TIMESTAMPTZ normalization. Per-problem options for legitimate drift land later in Phase 4.
- **Read-only guard hardening (optional):** swap the regex/first-keyword guard for a tokenizer-based check to close adversarial-input edge cases.
- **Telemetry harness:** so Phase 3's "before/after" claims are measurable rather than asserted.

### Phase 2: Authoring Correctness

With the CI audit floor already in place from Phase 1, Phase 2 adds the publish-time and admin-time gates: static lint for dialect-specific SQL, row diffs in admin capture flows, and a server-side publish gate that reuses the same `lib/sql-engine/admin-audit.ts` helper the CI script imports — single source of truth for "is this pair valid."

### Phase 3: Startup Responsiveness

Warm engines before the user reaches the workspace, persist the expensive pieces where possible, and investigate DuckDB bundle-size reduction. Every PR here cites before/after numbers from the Phase 1 telemetry sink. Note: DuckDB-WASM has no OPFS persistence story today, so persistence work is asymmetric — PGlite gets full IndexedDB persistence, DuckDB gets only asset caching.

### Phase 4: Validator Options & Legacy Cleanup

Per-problem validation options for legitimate drift that wasn't fixed unconditionally in Phase 1: case-insensitive strings, decimal tolerance, timestamp mode, JSON mode toggles. Phase 4 also drops the legacy `solutionSql` / `expectedOutput` (singular) columns carried over from v0.4.2 — gated on `audit:dialects` passing against prod data.

### Phase 5: Learner Workspace UX

Use existing schema parser data to power Monaco completions and column-type tooltips. Add friendly SQL error translation, attempt diffing, and query-plan visualization for advanced lessons.

### Phase 6: More Dialects

Only add more dialects once Phases 1 and 2 are in place. SQLite via `sql.js` is the only near-term fully executable browser dialect; its lack of async cancellation drops cleanly into the recreate-only path PGlite already uses. MySQL stays parked. BigQuery, Snowflake, and Redshift are syntax-only modes unless execution is available.

## Non-Goals

- Do not build a server-side SQL runner in the next engine PR.
- Do not add MySQL by tunneling learner SQL into the production database.
- Do not make BigQuery/Snowflake/Redshift look fully validated if they are syntax-only.
- Do not combine startup caching, validator behavior, and Monaco UX in one PR.

## Architecture Direction

`lib/sql-engine/` becomes the stable execution boundary:

- `browser-session.ts` owns engine initialization, schema replay, read-only guard enforcement, row normalization, and disposal.
- `dialect-audit.ts` owns per-dialect audit input resolution for the current CI audit script.
- Future `runtime-controls.ts` owns timeout/cancel/reset behavior. Engine-agnostic contract — DuckDB, PGlite, and SQLite all fall back to dispose-and-recreate since none has reliable async cancellation.
- Future `telemetry.ts` emits `engine.init.start`, `engine.init.ready`, `engine.firstQuery.ready`, `engine.dispose` events. Phase 1 dependency for everything in Phase 3.
- Future `admin-audit.ts` is the single source of truth for `(problem, dialect)` validity — imported by both the CI audit script and the publish-time gate so they cannot disagree.
- Future `engine-cache.ts` owns warm-up and persistence decisions, bounded to one warm session per dialect.
- Future `errors.ts` translates raw engine errors into user-facing hints.
- Future `schema-completions.ts` derives Monaco suggestions from parsed schema data.

Admin and CI flows reuse the same engine helpers so "what learners run" == "what authors validate" == "what CI checks." This isn't aspirational — Phase 2 PR 2.3 makes it a hard constraint.

## Trust Boundary

`validateSubmission` currently trusts client-provided `userResult` rows. A forged POST gets marked solved. This plan **does not fix that** — it requires server-side SQL execution, which is deliberately out of scope. Listed here so it isn't forgotten:

- Path 1: server runs the learner's SQL on a sandboxed engine and compares its own rows.
- Path 2: hidden expected outputs the client never sees; submission posts SQL text only.

Both depend on a server runner. Revisit after Phase 4 ships.

## Release Strategy

Ship each phase as one or more PRs into `main`, then promote through the existing `main -> production` release PR. Phase 1 PRs (CI audit, row cap, timeout, JSON/timestamp fixes, telemetry) can release independently and in any order — each is small and self-contained. Phase 3 startup caching should be measured on preview before production because service worker and persistence bugs are sticky. The Phase 4 legacy column drop must wait until `audit:dialects` is green against prod data.
