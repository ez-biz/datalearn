"use client"

import { useEffect, useRef, useState } from "react"
import { initDuckDB } from "@/lib/duckdb"
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm"

export type Row = Record<string, unknown>

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

export function useProblemDB(schemaSql: string | null | undefined): ProblemDBState {
    const dbRef = useRef<AsyncDuckDB | null>(null)
    const connRef = useRef<AsyncDuckDBConnection | null>(null)
    const [ready, setReady] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function load() {
            try {
                const db = await initDuckDB()
                if (cancelled) return
                dbRef.current = db
                const conn = await db.connect()
                if (cancelled) return
                connRef.current = conn

                const schema = schemaSql || DEFAULT_FALLBACK_SCHEMA
                const statements = schema
                    .split(/;\s*\n|;\s*$/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)

                for (const stmt of statements) {
                    try {
                        await conn.query(stmt)
                    } catch (stmtErr: any) {
                        console.error(
                            "Schema statement failed:",
                            stmt.substring(0, 80),
                            stmtErr?.message
                        )
                        throw stmtErr
                    }
                }

                if (!cancelled) setReady(true)
            } catch (e: any) {
                if (!cancelled) {
                    console.error("Failed to init DuckDB", e)
                    setError(
                        "Failed to initialize the SQL engine. Try refreshing the page."
                    )
                }
            }
        }

        load()
        return () => {
            cancelled = true
        }
    }, [schemaSql])

    async function runQuery(sql: string): Promise<Row[]> {
        if (!connRef.current) {
            throw new Error("Database is not ready yet.")
        }
        const arrowTable = await connRef.current.query(sql)
        return arrowTable.toArray().map((row: any) => row.toJSON())
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
