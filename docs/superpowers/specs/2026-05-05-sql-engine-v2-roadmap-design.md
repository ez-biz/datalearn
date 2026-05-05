# SQL Engine v2 Roadmap Design

## Goal

Turn the SQL engine work into a sequence of small PRs that improve reliability, authoring correctness, startup responsiveness, and learner experience without losing the current low-cost browser execution model.

## Current Baseline

Data Learn now has a browser engine session boundary in `lib/sql-engine/`. DuckDB-WASM and PGlite still run client-side, and `useProblemDB` owns only React lifecycle state. This is the right base for the next engine work because future changes can happen behind the same `{ runQuery, dispose }` session contract.

## Product Priorities

1. **Correctness and safety first.** A wrong answer accepted or a correct answer rejected damages trust more than a slow first load.
2. **Fast perceived startup second.** Reduce the 1-3 second cold-start pain after the execution path is safe and cancellable.
3. **Authoring gates before more dialects.** More engines multiply drift; publish-time and CI audits should be stronger before adding SQLite or syntax-only dialects.
4. **Learner UX after the engine boundary is stable.** Monaco autocomplete, tooltips, and friendlier errors are high-impact, but they should consume stable engine/schema APIs.

## Phased Scope

### Phase 1: Runtime Safety

Add query timeout, cancel/reset behavior, row-count caps, and clearer runtime error boundaries. This prevents runaway queries from freezing the tab and makes later warm-up/persistence changes safer.

### Phase 2: Authoring Correctness

Move dialect audit into CI, add static lint for dialect-specific SQL, show row diffs in admin capture flows, and reject publish attempts when any listed dialect fails its solution/output pair.

### Phase 3: Startup Responsiveness

Warm engines before the user reaches the workspace, cache or persist the expensive pieces where possible, and investigate DuckDB bundle-size reduction. These should be measured with simple timing telemetry before and after.

### Phase 4: Validator Robustness

Add per-problem validation options for legitimate dialect drift: case-insensitive string comparison, explicit NULL ordering guidance, nested JSON equality, decimal tolerance, and timezone-aware timestamp normalization.

### Phase 5: Learner Workspace UX

Use existing schema parser data to power Monaco completions and column-type tooltips. Add friendly SQL error translation, attempt diffing, and query-plan visualization for advanced lessons.

### Phase 6: More Dialects

Only add more dialects once Phases 1 and 2 are in place. SQLite via `sql.js` is the only near-term fully executable browser dialect. MySQL should stay parked until there is a production-grade WASM runtime or a deliberate server-side sandbox. BigQuery, Snowflake, and Redshift should be treated as syntax-only modes unless execution is available.

## Non-Goals

- Do not build a server-side SQL runner in the next engine PR.
- Do not add MySQL by tunneling learner SQL into the production database.
- Do not make BigQuery/Snowflake/Redshift look fully validated if they are syntax-only.
- Do not combine startup caching, validator behavior, and Monaco UX in one PR.

## Architecture Direction

`lib/sql-engine/` becomes the stable execution boundary:

- `browser-session.ts` owns engine initialization, schema replay, read-only guard enforcement, row normalization, and disposal.
- Future `runtime-controls.ts` should own timeout/cancel/reset behavior.
- Future `engine-cache.ts` should own warm-up and persistence decisions.
- Future `errors.ts` should translate raw engine errors into user-facing hints.
- Future `schema-completions.ts` should derive Monaco suggestions from parsed schema data.

Admin and CI flows should reuse the same engine helpers where practical so "what learners run" and "what authors validate" do not drift.

## Release Strategy

Ship each phase as one or more PRs into `main`, then promote through the existing `main -> production` release PR. Runtime safety and authoring gates can release before startup UX. Startup caching should be measured on preview before production because service worker and persistence bugs can be sticky.
