import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"
import { checkReadOnlyQuery } from "@/lib/sql-restrict"
import { normalizeSqlRows } from "@/lib/sql-engine/normalize"
import { splitSqlStatements } from "@/lib/sql-engine/statements"
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
}

export async function createSqlEngineSession({
    schemaSql,
    dialect,
}: CreateSqlEngineSessionInput): Promise<SqlEngineSession> {
    const schema = schemaSql || DEFAULT_FALLBACK_SCHEMA
    const statements = splitSqlStatements(schema)

    if (dialect === "POSTGRES") {
        return createPostgresSession(statements)
    }

    return createDuckDbSession(statements)
}

async function createPostgresSession(
    statements: string[]
): Promise<SqlEngineSession> {
    const { initPGlite } = await import("@/lib/pglite")
    const pg = await initPGlite()
    await replaySchemaStatements("POSTGRES", statements, (statement) =>
        pg.exec(statement)
    )

    return {
        dialect: "POSTGRES",
        async runQuery(sql) {
            assertReadOnly(sql)
            const result = await pg.query<SqlRow>(sql)
            return normalizeSqlRows(result.rows)
        },
        async dispose() {
            await pg.close()
        },
    }
}

async function createDuckDbSession(
    statements: string[]
): Promise<SqlEngineSession> {
    const { initDuckDB } = await import("@/lib/duckdb")
    const db = await initDuckDB()
    const conn = await db.connect()
    await replaySchemaStatements("DUCKDB", statements, (statement) =>
        conn.query(statement)
    )

    return {
        dialect: "DUCKDB",
        async runQuery(sql) {
            assertReadOnly(sql)
            const arrowTable = await conn.query(sql)
            const rows = arrowTable
                .toArray()
                .map((row) =>
                    typeof row?.toJSON === "function" ? row.toJSON() : row
                )
            return normalizeSqlRows(rows)
        },
        async dispose() {
            await disposeDuckDb(db, conn)
        },
    }
}

function assertReadOnly(sql: string): void {
    const guard = checkReadOnlyQuery(sql)
    if (!guard.ok) {
        throw new Error(guard.reason)
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
