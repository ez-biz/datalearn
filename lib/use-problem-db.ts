"use client"

import { useEffect, useRef, useState } from "react"
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"
import type { PGlite } from "@electric-sql/pglite"

export type Row = Record<string, unknown>
export type Dialect = "DUCKDB" | "POSTGRES"

export interface ProblemDBState {
    ready: boolean
    error: string | null
    runQuery: (sql: string) => Promise<Row[]>
}

const DEFAULT_FALLBACK_SCHEMA = `
CREATE TABLE users (id INTEGER, name VARCHAR, role VARCHAR);
INSERT INTO users VALUES (1, 'Alice', 'Engineer');
INSERT INTO users VALUES (2, 'Bob', 'Data Scientist');
INSERT INTO users VALUES (3, 'Charlie', 'Manager');
`

/**
 * Per-dialect SQL engine hook. Dynamically imports the right engine
 * (DuckDB-WASM or PGlite) so users only download the bundle they pick.
 *
 * Re-mounts on dialect change — both engines are ephemeral per-page,
 * and the schema is replayed each time. That's intentional: switching
 * engines should give a clean slate.
 */
export function useProblemDB(
    schemaSql: string | null | undefined,
    dialect: Dialect = "DUCKDB"
): ProblemDBState {
    const duckRef = useRef<{
        db: AsyncDuckDB
        conn: AsyncDuckDBConnection
    } | null>(null)
    const pgRef = useRef<PGlite | null>(null)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setReady(false)
        setError(null)

        async function load() {
            try {
                const schema = schemaSql || DEFAULT_FALLBACK_SCHEMA
                const statements = splitStatements(schema)

                if (dialect === "POSTGRES") {
                    const { initPGlite } = await import("@/lib/pglite")
                    const pg = await initPGlite()
                    if (cancelled) return
                    pgRef.current = pg
                    for (const stmt of statements) {
                        try {
                            await pg.exec(stmt)
                        } catch (stmtErr: any) {
                            console.error(
                                "[pglite] schema statement failed:",
                                stmt.substring(0, 80),
                                stmtErr?.message
                            )
                            throw stmtErr
                        }
                    }
                } else {
                    const { initDuckDB } = await import("@/lib/duckdb")
                    const db = await initDuckDB()
                    if (cancelled) return
                    const conn = await db.connect()
                    if (cancelled) return
                    duckRef.current = { db, conn }
                    for (const stmt of statements) {
                        try {
                            await conn.query(stmt)
                        } catch (stmtErr: any) {
                            console.error(
                                "[duckdb] schema statement failed:",
                                stmt.substring(0, 80),
                                stmtErr?.message
                            )
                            throw stmtErr
                        }
                    }
                }

                if (!cancelled) setReady(true)
            } catch (e: any) {
                if (!cancelled) {
                    console.error(`Failed to init ${dialect}`, e)
                    setError(
                        `Failed to initialize the ${dialect === "POSTGRES" ? "Postgres" : "DuckDB"} engine. Try refreshing the page.`
                    )
                }
            }
        }

        load()
        return () => {
            cancelled = true
            // Clean up — PGlite has no explicit close in current API; GC
            // handles it. DuckDB connection is closed implicitly when
            // the worker is collected. Both are fine for our usage.
            duckRef.current = null
            pgRef.current = null
        }
    }, [schemaSql, dialect])

    async function runQuery(sql: string): Promise<Row[]> {
        if (dialect === "POSTGRES") {
            if (!pgRef.current) throw new Error("Database is not ready yet.")
            const result = await pgRef.current.query<Row>(sql)
            return result.rows
        }
        if (!duckRef.current) throw new Error("Database is not ready yet.")
        const arrowTable = await duckRef.current.conn.query(sql)
        return arrowTable.toArray().map((row: any) => row.toJSON())
    }

    return { ready, error, runQuery }
}

function splitStatements(schema: string): string[] {
    return schema
        .split(/;\s*\n|;\s*$/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
}

/** Pull `CREATE TABLE <name>` identifiers out of schema SQL. */
export function extractTableNames(schemaSql: string | null | undefined): string[] {
    if (!schemaSql) return []
    const seen = new Set<string>()
    const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?["`]?([a-zA-Z_][\w]*)["`]?/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(schemaSql)) !== null) {
        seen.add(m[1])
    }
    return Array.from(seen)
}
