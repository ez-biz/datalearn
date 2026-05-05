# SQL Engine v2 Foundation Design

## Goal

Build a cleaner SQL execution boundary for Data Learn without changing learner behavior. The current DuckDB-WASM and PGlite engines stay in the browser; this work makes their lifecycle, row normalization, and query execution easier to extend safely.

## Scope

This foundation includes:

- A shared engine interface for browser SQL sessions.
- DuckDB and Postgres/PGlite adapter functions behind that interface.
- Shared JSON-safe result normalization used before rows leave the engine layer.
- The existing read-only guard remains at the learner query boundary.
- `useProblemDB` becomes a React lifecycle wrapper around the engine layer.

This foundation does not include:

- A server-side SQL runner.
- MySQL, Spark, BigQuery, or Snowflake support.
- Hidden test cases.
- Query cancellation UI.
- Any learner-facing design change.

## Architecture

`lib/sql-engine/` owns engine-agnostic SQL execution concerns. It exposes a small `createSqlEngineSession()` factory that initializes the selected browser engine, replays schema SQL, and returns a session with `runQuery()` and `dispose()`.

`lib/use-problem-db.ts` remains the React hook used by the practice workspace. Its responsibility shrinks to lifecycle state: create a session when `schemaSql` or `dialect` changes, dispose it on unmount, and call `session.runQuery()` from the controlled playground.

Shared normalization lives in `lib/sql-engine/normalize.ts`. It converts engine-specific values such as `Date`, `bigint`, and object wrappers into JSON-safe scalar values so ResultTable display, submission validation payloads, and future admin capture flows get consistent rows.

## Data Flow

1. `ProblemClient` chooses a `dialect`.
2. `useProblemDB(schemaSql, dialect)` creates a SQL engine session.
3. The session initializes DuckDB-WASM or PGlite lazily.
4. The session replays schema statements directly, bypassing the read-only learner guard.
5. Learner calls to `runQuery(sql)` pass through `checkReadOnlyQuery()`.
6. Engine rows are normalized before returning to React.
7. `SqlPlayground` submits normalized rows to `validateSubmission()`.

## Error Handling

Schema initialization errors still produce the current workspace message: "Failed to initialize the DuckDB/Postgres engine. Try refreshing the page."

Read-only guard errors keep their precise user-facing reason.

Engine runtime errors continue to bubble to `SqlPlayground`, which already renders the message in the results panel.

## Testing

Add focused Node tests for row normalization because it is pure and easy to verify. Keep existing SQL read-only behavior covered by the current guard script. Run lint and a small inline guard check while local `tsx` resolution remains unavailable in this sandbox.

## Future Work

After this foundation, SQL Engine v2 can add timeout/cancel semantics, better parser-backed read-only validation, admin expected-output capture through the same session interface, and eventually an optional server-side runner for heavier workloads.
