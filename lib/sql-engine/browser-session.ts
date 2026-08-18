import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"
import type { PGlite as PGliteType } from "@electric-sql/pglite"
import { checkReadOnlyQuery } from "@/lib/sql-restrict"
import { normalizeSqlRows } from "@/lib/sql-engine/normalize"
import { evictStalePgliteDatabases } from "@/lib/sql-engine/pglite-eviction"
import { applyRowCap, toRowLimitedSql } from "@/lib/sql-engine/result-cap"
import {
    resolvePgliteDataDir,
    type ResolvedDataDir,
} from "@/lib/sql-engine/schema-cache-key"
import { splitSqlStatements } from "@/lib/sql-engine/statements"
import {
    createSqlEngineTelemetrySession,
    type SqlEngineTelemetrySession,
} from "@/lib/sql-engine/telemetry"
import type { Dialect, SqlEngineSession, SqlRow } from "@/lib/sql-engine/types"
import { claimWarmDuckDB } from "@/lib/sql-engine/warmup"

const DEFAULT_FALLBACK_SCHEMA = `
CREATE TABLE users (id INTEGER, name VARCHAR, role VARCHAR);
INSERT INTO users VALUES (1, 'Alice', 'Engineer');
INSERT INTO users VALUES (2, 'Bob', 'Data Scientist');
INSERT INTO users VALUES (3, 'Charlie', 'Manager');
`

type CreateSqlEngineSessionInput = {
    schemaSql: string | null | undefined
    dialect: Dialect
    problemSlug?: string
}

export async function createSqlEngineSession({
    schemaSql,
    dialect,
    problemSlug,
}: CreateSqlEngineSessionInput): Promise<SqlEngineSession> {
    const schema = schemaSql || DEFAULT_FALLBACK_SCHEMA
    const statements = splitSqlStatements(schema)
    const telemetry = createSqlEngineTelemetrySession({
        dialect,
        problemSlug,
        schemaStatementCount: statements.length,
    })

    telemetry.emit("engine.init.start")

    const session =
        dialect === "POSTGRES"
            ? await createPostgresSession(
                  schema,
                  statements,
                  problemSlug,
                  telemetry
              )
            : await createDuckDbSession(statements)

    // For DUCKDB, attach where the bundle was fetched from so we can
    // split self-host vs. CDN performance in the dashboard. POSTGRES
    // skips this — PGlite bundling is uniform.
    if (dialect === "DUCKDB") {
        const { getLastDuckDbBundleSource } = await import("@/lib/duckdb")
        const bundleSource = getLastDuckDbBundleSource()
        if (bundleSource) {
            telemetry.emit("engine.init.ready", { bundleSource })
        } else {
            telemetry.emit("engine.init.ready")
        }
    } else {
        telemetry.emit("engine.init.ready")
    }
    return instrumentSqlEngineSession(session, telemetry)
}

async function createPostgresSession(
    schemaSql: string,
    statements: string[],
    problemSlug: string | undefined,
    telemetry: SqlEngineTelemetrySession
): Promise<SqlEngineSession> {
    const { initPGlite } = await import("@/lib/pglite")
    const persistence = problemSlug
        ? await resolvePgliteDataDir({ slug: problemSlug, schemaSql })
        : ({ mode: "memory", reason: "no problem slug" } as const)

    // Best-effort registry bookkeeping + eviction of stale/excess cached
    // PGlite databases. Never blocks or fails session creation — see
    // evictStalePgliteDatabases's doc comment. Runs before `connect` below
    // so a fresh cluster never gets deleted out from under this session:
    // the current database name is always passed through as exempt.
    await evictStalePgliteDatabases(
        persistence.mode === "indexeddb" ? persistence.name : null,
        {
            deleteIndexedDb: deleteBrowserIndexedDb,
            toIdbDatabaseName: pgliteIdbDatabaseName,
        }
    )

    // `connect` remembers whatever persistence the *previous* call settled
    // on (see createPostgresResourceFactory) so a session that already
    // recovered into memory mode doesn't repeat the failed idb ladder on
    // every subsequent reset().
    const connect = createPostgresResourceFactory(
        initPGlite,
        statements,
        persistence,
        telemetry
    )

    let pg: PGliteType | null = await connect()
    let disposed = false
    let resetPromise: Promise<void> | null = null

    const reset = async () => {
        if (disposed) return
        resetPromise ??= (async () => {
            const current = pg
            pg = null
            if (current) await current.close()
            if (!disposed) {
                const next = await connect()
                if (disposed) {
                    await next.close()
                    return
                }
                pg = next
            }
        })().finally(() => {
            resetPromise = null
        })
        await resetPromise
    }

    const currentPg = async () => {
        if (resetPromise) await resetPromise
        if (!pg) throw new Error("Postgres engine is not ready yet.")
        return pg
    }

    return {
        dialect: "POSTGRES",
        async runQuery(sql, options) {
            assertReadOnly(sql)
            const result = await (await currentPg()).query<SqlRow>(
                toRowLimitedSql(sql, options?.rowCap)
            )
            return applyRowCap(normalizeSqlRows(result.rows), options?.rowCap)
        },
        async cancel() {
            await reset()
        },
        reset,
        async dispose() {
            disposed = true
            const current = pg
            pg = null
            if (current) await current.close()
        },
    }
}

async function createDuckDbSession(
    statements: string[]
): Promise<SqlEngineSession> {
    const { initDuckDB } = await import("@/lib/duckdb")
    // First-time creation tries to claim a pre-warmed DuckDB instance.
    // Reset re-uses the fresh init path — claim is only valid on the
    // initial session boundary.
    const warmed = claimWarmDuckDB()
    let resources: DuckDbResources | null = warmed
        ? await connectDuckDb(warmed, statements)
        : await createDuckDbResources(initDuckDB, statements)
    let disposed = false
    let resetPromise: Promise<void> | null = null

    const reset = async () => {
        if (disposed) return
        resetPromise ??= (async () => {
            const current = resources
            resources = null
            if (current) await disposeDuckDb(current.db, current.conn)
            if (!disposed) {
                const next = await createDuckDbResources(initDuckDB, statements)
                if (disposed) {
                    await disposeDuckDb(next.db, next.conn)
                    return
                }
                resources = next
            }
        })().finally(() => {
            resetPromise = null
        })
        await resetPromise
    }

    const currentResources = async () => {
        if (resetPromise) await resetPromise
        if (!resources) throw new Error("DuckDB engine is not ready yet.")
        return resources
    }

    return {
        dialect: "DUCKDB",
        async runQuery(sql, options) {
            assertReadOnly(sql)
            const { conn } = await currentResources()
            const arrowTable = await conn.query(
                toRowLimitedSql(sql, options?.rowCap)
            )
            const rows = arrowTable
                .toArray()
                .map((row) =>
                    typeof row?.toJSON === "function" ? row.toJSON() : row
            )
            return applyRowCap(normalizeSqlRows(rows), options?.rowCap)
        },
        async cancel() {
            await reset()
        },
        reset,
        async dispose() {
            disposed = true
            const current = resources
            resources = null
            if (current) await disposeDuckDb(current.db, current.conn)
        },
    }
}

export async function createPostgresResources(
    initPGlite: (options?: { dataDir?: string }) => Promise<PGliteType>,
    statements: string[],
    persistence: ResolvedDataDir,
    telemetry?: SqlEngineTelemetrySession,
    deleteIndexedDb: (name: string) => Promise<void> = deleteBrowserIndexedDb,
    onPersistenceResolved?: (persistence: ResolvedDataDir) => void
): Promise<PGliteType> {
    const { pg, persistence: effectivePersistence } =
        await initPostgresConnection(
            initPGlite,
            persistence,
            telemetry,
            deleteIndexedDb
        )
    onPersistenceResolved?.(effectivePersistence)

    if (
        effectivePersistence.mode === "indexeddb" &&
        (await isPersistedSchemaReady(pg))
    ) {
        if (process.env.NODE_ENV !== "production") {
            console.debug(
                "[sql-engine] PGlite cache hit",
                { dataDir: effectivePersistence.name }
            )
        }
        return pg
    }

    if (process.env.NODE_ENV !== "production") {
        console.debug("[sql-engine] PGlite fresh init", {
            mode: effectivePersistence.mode,
            dataDir:
                effectivePersistence.mode === "indexeddb"
                    ? effectivePersistence.name
                    : null,
            reason:
                effectivePersistence.mode === "memory"
                    ? effectivePersistence.reason
                    : "first-time",
        })
    }

    await replaySchemaStatements("POSTGRES", statements, (statement) =>
        pg.exec(statement)
    )

    if (effectivePersistence.mode === "indexeddb") {
        await writePersistedSchemaMetadata(pg)
    }

    return pg
}

/**
 * Wraps `createPostgresResources` so repeated calls — the initial connect
 * plus every `reset()` for the life of a session — reuse whatever
 * persistence the *previous* call settled on, rather than the persistence
 * the session started with.
 *
 * Without this, a session that already recovered into memory mode (its
 * persisted IndexedDB cluster was corrupt and even the fresh-cluster retry
 * failed) would repeat the *entire* failed ladder on every subsequent
 * reset: another doomed idb init, another delete, another doomed retry,
 * another fallback — two guaranteed-to-fail inits and a delete added to
 * exactly the sessions that can least afford the extra latency. Tracking
 * the settled persistence in this closure means a degraded session just
 * stays in memory mode from then on.
 */
export function createPostgresResourceFactory(
    initPGlite: (options?: { dataDir?: string }) => Promise<PGliteType>,
    statements: string[],
    initialPersistence: ResolvedDataDir,
    telemetry?: SqlEngineTelemetrySession,
    deleteIndexedDb: (name: string) => Promise<void> = deleteBrowserIndexedDb
): () => Promise<PGliteType> {
    let persistence = initialPersistence
    return () =>
        createPostgresResources(
            initPGlite,
            statements,
            persistence,
            telemetry,
            deleteIndexedDb,
            (resolved) => {
                persistence = resolved
            }
        )
}

/**
 * Connects to Postgres, self-healing a corrupt persisted IndexedDB
 * cluster rather than surfacing a dead end.
 *
 * PGlite throws when the WASM module loads fine but Postgres refuses to
 * start against its data directory — typically a partial/interrupted
 * first write to IndexedDB. Because every reload re-opens the same
 * store, that failure is otherwise permanent for the learner. Recovery
 * ladder, each rung only reached if the previous one failed:
 *   1. Init against the persisted `idb://` data dir (the normal path).
 *   2. Delete that IndexedDB database and retry once with the *same*
 *      data dir — a fresh cluster, so persistence keeps working on the
 *      next visit.
 *   3. Fall back to memory mode (`dataDir: undefined`) so the learner
 *      can still solve the problem, just without caching.
 * If step 3 also fails, the error propagates — there is nothing further
 * to fall back to.
 *
 * Memory-mode sessions (no problem slug, cache opted out, IndexedDB/
 * WebCrypto unavailable, or key derivation failed) skip straight past
 * this ladder: there is no persisted store to be corrupt, so a failure
 * there is not recoverable and must surface immediately.
 */
async function initPostgresConnection(
    initPGlite: (options?: { dataDir?: string }) => Promise<PGliteType>,
    persistence: ResolvedDataDir,
    telemetry: SqlEngineTelemetrySession | undefined,
    deleteIndexedDb: (name: string) => Promise<void>
): Promise<{ pg: PGliteType; persistence: ResolvedDataDir }> {
    if (persistence.mode !== "indexeddb") {
        const pg = await initPGlite({ dataDir: undefined })
        return { pg, persistence }
    }

    const dataDir = `idb://${persistence.name}`

    try {
        const pg = await initPGlite({ dataDir })
        return { pg, persistence }
    } catch (firstError) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(
                "[sql-engine] PGlite init failed against its persisted data dir, attempting recovery",
                { dataDir: persistence.name, error: errorMessage(firstError) }
            )
        }

        const idbName = pgliteIdbDatabaseName(persistence.name)
        await deleteIndexedDb(idbName).catch((deleteError) => {
            if (process.env.NODE_ENV !== "production") {
                console.warn(
                    "[sql-engine] failed to delete corrupt PGlite IndexedDB store",
                    { idbName, error: errorMessage(deleteError) }
                )
            }
        })

        try {
            const pg = await initPGlite({ dataDir })
            telemetry?.emit("engine.init.recovered", {
                recoveryOutcome: "idb-retry",
            })
            return { pg, persistence }
        } catch (secondError) {
            if (process.env.NODE_ENV !== "production") {
                console.warn(
                    "[sql-engine] PGlite retry against a fresh data dir also failed, falling back to memory mode",
                    { dataDir: persistence.name, error: errorMessage(secondError) }
                )
            }

            const pg = await initPGlite({ dataDir: undefined })
            telemetry?.emit("engine.init.recovered", {
                recoveryOutcome: "memory-fallback",
            })
            return {
                pg,
                persistence: {
                    mode: "memory",
                    reason: "recovered after corrupt IndexedDB cache",
                },
            }
        }
    }
}

/**
 * Root Emscripten mount path PGlite's IDBFS backend uses for every
 * `idb://` data dir. Determined by reading the compiled package at
 * `node_modules/@electric-sql/pglite/dist/index.js` (v0.5.4): the IdbFs
 * class mounts IDBFS at `` `${K}/${this.dataDir}` `` where `K` is the
 * module-level constant `"/pglite"` (`chunk-TDKVRJ2S.js`, `var
 * I="/pglite"`) and `this.dataDir` is whatever follows `idb://` in the
 * `dataDir` option. Emscripten's IDBFS then opens the browser's actual
 * IndexedDB database using that *mount path* as its name
 * (`IDBFS.getDB(mount.mountpoint, ...)` -> `indexedDB.open(mountpoint,
 * ...)`), not the bare name after the `idb://` prefix. So the real
 * IndexedDB database for `idb://datalearn-pglite-foo-abc123` is named
 * `/pglite/datalearn-pglite-foo-abc123`, not `datalearn-pglite-foo-abc123`
 * and not `idb://datalearn-pglite-foo-abc123`. Deleting the wrong name
 * would silently no-op, leaving the corrupt store in place and making
 * every retry fail identically.
 */
const PGLITE_IDB_MOUNT_ROOT = "/pglite"

/**
 * Exported so `lib/sql-engine/pglite-eviction.ts` can reuse this exact
 * derivation instead of re-deriving it — see that module's
 * `EvictStalePgliteDatabasesDeps.toIdbDatabaseName` doc comment.
 */
export function pgliteIdbDatabaseName(name: string): string {
    return `${PGLITE_IDB_MOUNT_ROOT}/${name}`
}

const DELETE_INDEXED_DB_TIMEOUT_MS = 3000

/**
 * Deletes a browser IndexedDB database by name. Used as the production
 * default for `createPostgresResources`'s injectable `deleteIndexedDb`
 * parameter — tests inject a fake instead of touching real IndexedDB.
 * Also exported for `pglite-eviction.ts` to reuse for its own deletes,
 * rather than duplicating the blocked/timeout handling below.
 */
export function deleteBrowserIndexedDb(name: string): Promise<void> {
    if (typeof indexedDB === "undefined") return Promise.resolve()

    const deletion = new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name)
        request.onsuccess = () => resolve()
        request.onerror = () =>
            reject(
                request.error ??
                    new Error(`Failed to delete IndexedDB database "${name}"`)
            )
        request.onblocked = () => {
            // Doesn't reject — the request just waits for other open
            // connections to close, which could hang indefinitely if the
            // failed PGlite instance left one open. The timeout below
            // caps how long we wait for it.
            console.warn(
                `[sql-engine] IndexedDB delete blocked for "${name}" — a stale connection may still be open`
            )
        }
    })

    // If `deletion` rejects only after the timeout below has already won
    // the race, nothing else observes that rejection — attach a trailing
    // no-op catch so it doesn't surface as unhandled-rejection console
    // noise. This runs on a separate derived promise and doesn't change
    // what `Promise.race` below observes from `deletion` itself, so a
    // rejection that arrives *before* the timeout still loses the race
    // and still propagates to the caller's warning log.
    deletion.catch(() => {})

    return Promise.race([
        deletion,
        new Promise<void>((resolve) => {
            setTimeout(resolve, DELETE_INDEXED_DB_TIMEOUT_MS)
        }),
    ])
}

const PERSISTED_SCHEMA_TABLE = "_dl_pglite_meta"

async function isPersistedSchemaReady(pg: PGliteType): Promise<boolean> {
    try {
        const result = await pg.query<{ initialized: string }>(
            `SELECT value AS initialized FROM ${PERSISTED_SCHEMA_TABLE} WHERE key = 'initialized' LIMIT 1`
        )
        return result.rows.length > 0
    } catch {
        return false
    }
}

async function writePersistedSchemaMetadata(pg: PGliteType): Promise<void> {
    await pg.exec(
        `CREATE TABLE IF NOT EXISTS ${PERSISTED_SCHEMA_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
    )
    await pg.exec(
        `INSERT INTO ${PERSISTED_SCHEMA_TABLE} (key, value) VALUES ('initialized', 'true') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`
    )
}

type DuckDbResources = {
    db: AsyncDuckDB
    conn: AsyncDuckDBConnection
}

async function createDuckDbResources(
    initDuckDB: () => Promise<AsyncDuckDB>,
    statements: string[]
): Promise<DuckDbResources> {
    const db = await initDuckDB()
    return connectDuckDb(db, statements)
}

async function connectDuckDb(
    db: AsyncDuckDB,
    statements: string[]
): Promise<DuckDbResources> {
    const conn = await db.connect()
    await replaySchemaStatements("DUCKDB", statements, (statement) =>
        conn.query(statement)
    )
    return { db, conn }
}

function assertReadOnly(sql: string): void {
    const guard = checkReadOnlyQuery(sql)
    if (!guard.ok) {
        throw new Error(guard.reason)
    }
}

/**
 * Telemetry tracks the lifecycle of the React-side session, not each
 * recycle of the inner engine. `session.reset()` (e.g. after a query
 * timeout) replaces the underlying DuckDB / PGlite instance but does not
 * emit `engine.dispose` — only navigation away from the page does.
 * `engine.firstQuery.ready` is one-shot for the same reason: if the user
 * keeps querying after a reset, we don't re-emit it.
 */
function instrumentSqlEngineSession(
    session: SqlEngineSession,
    telemetry: SqlEngineTelemetrySession
): SqlEngineSession {
    let firstQueryReady = false
    let disposed = false

    return {
        dialect: session.dialect,
        async runQuery(sql, options) {
            const queryStartedAtMs = telemetry.now()
            const result = await session.runQuery(sql, options)
            if (!firstQueryReady) {
                firstQueryReady = true
                telemetry.emit("engine.firstQuery.ready", {
                    queryElapsedMs: telemetry.elapsedSince(queryStartedAtMs),
                })
            }
            return result
        },
        cancel: () => session.cancel(),
        reset: () => session.reset(),
        async dispose() {
            try {
                await session.dispose()
            } finally {
                if (!disposed) {
                    disposed = true
                    telemetry.emit("engine.dispose")
                }
            }
        },
    }
}

async function replaySchemaStatements(
    dialect: Dialect,
    statements: string[],
    execute: (statement: string) => Promise<unknown>
): Promise<void> {
    for (const statement of statements) {
        try {
            await execute(statement)
        } catch (error) {
            console.error(
                `[${dialect.toLowerCase()}] schema statement failed:`,
                statement.substring(0, 80),
                errorMessage(error)
            )
            throw error
        }
    }
}

async function disposeDuckDb(
    db: AsyncDuckDB,
    conn: AsyncDuckDBConnection
): Promise<void> {
    try {
        await conn.close()
    } finally {
        await db.terminate()
    }
}

function errorMessage(error: unknown): string | undefined {
    return error instanceof Error ? error.message : undefined
}
