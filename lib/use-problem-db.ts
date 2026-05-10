"use client"

import { useEffect, useRef, useState } from "react"
import { createSqlEngineSession } from "@/lib/sql-engine/browser-session"
import type {
    Dialect,
    SqlEngineSession,
    SqlRow as Row,
} from "@/lib/sql-engine/types"

export type { Dialect, SqlRow as Row } from "@/lib/sql-engine/types"

export interface ProblemDBState {
    ready: boolean
    error: string | null
    runQuery: (sql: string) => Promise<Row[]>
}

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
    const sessionRef = useRef<SqlEngineSession | null>(null)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        setReady(false)
        setError(null)

        async function load() {
            try {
                const session = await createSqlEngineSession({
                    schemaSql,
                    dialect,
                })
                if (cancelled) {
                    await session.dispose()
                    return
                }
                sessionRef.current = session

                if (!cancelled) setReady(true)
            } catch (e) {
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
            const session = sessionRef.current
            sessionRef.current = null
            if (session) {
                void session.dispose().catch((disposeError) => {
                    console.warn(
                        `Failed to dispose ${session.dialect} SQL engine session:`,
                        disposeError
                    )
                })
            }
        }
    }, [schemaSql, dialect])

    async function runQuery(sql: string): Promise<Row[]> {
        if (!sessionRef.current) throw new Error("Database is not ready yet.")
        return sessionRef.current.runQuery(sql)
    }

    return { ready, error, runQuery }
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
