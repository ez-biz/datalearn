import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"
import type { PGlite as PGliteType } from "@electric-sql/pglite"
import { checkReadOnlyQuery } from "@/lib/sql-restrict"
import { normalizeSqlRows } from "@/lib/sql-engine/normalize"
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
            ? await createPostgresSession(schema, statements, problemSlug)
            : await createDuckDbSession(statements)

    telemetry.emit("engine.init.ready")
    return instrumentSqlEngineSession(session, telemetry)
}

async function createPostgresSession(
    schemaSql: string,
    statements: string[],
    problemSlug: string | undefined
): Promise<SqlEngineSession> {
    const { initPGlite } = await import("@/lib/pglite")
    const persistence = problemSlug
        ? await resolvePgliteDataDir({ slug: problemSlug, schemaSql })
        : ({ mode: "memory", reason: "no problem slug" } as const)

    let pg: PGliteType | null = await createPostgresResources(
        initPGlite,
        statements,
        persistence
    )
    let disposed = false
    let resetPromise: Promise<void> | null = null

    const reset = async () => {
        if (disposed) return
        resetPromise ??= (async () => {
            const current = pg
            pg = null
            if (current) await current.close()
            if (!disposed) {
                const next = await createPostgresResources(
                    initPGlite,
                    statements,
                    persistence
                )
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
    let resources: DuckDbResources | null = await createDuckDbResources(
        initDuckDB,
        statements
    )
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

async function createPostgresResources(
    initPGlite: (options?: { dataDir?: string }) => Promise<PGliteType>,
    statements: string[],
    persistence: ResolvedDataDir
): Promise<PGliteType> {
    const dataDir =
        persistence.mode === "indexeddb"
            ? `idb://${persistence.name}`
            : undefined

    const pg = await initPGlite({ dataDir })

    if (persistence.mode === "indexeddb" && (await isPersistedSchemaReady(pg))) {
        if (process.env.NODE_ENV !== "production") {
            console.debug(
                "[sql-engine] PGlite cache hit",
                { dataDir: persistence.name }
            )
        }
        return pg
    }

    if (process.env.NODE_ENV !== "production") {
        console.debug("[sql-engine] PGlite fresh init", {
            mode: persistence.mode,
            dataDir: persistence.mode === "indexeddb" ? persistence.name : null,
            reason: persistence.mode === "memory" ? persistence.reason : "first-time",
        })
    }

    await replaySchemaStatements("POSTGRES", statements, (statement) =>
        pg.exec(statement)
    )

    if (persistence.mode === "indexeddb") {
        await writePersistedSchemaMetadata(pg)
    }

    return pg
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
