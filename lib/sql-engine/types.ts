export type Dialect = "DUCKDB" | "POSTGRES"
export type SqlRow = Record<string, unknown>

export interface SqlQueryOptions {
    /**
     * Maximum rows returned to the caller. Engines may query cap + 1 rows
     * internally so they can report `truncated` without materializing an
     * unbounded result in React.
     */
    rowCap?: number | null
    /**
     * Maximum query runtime before the browser session is reset. Defaults to
     * the shared runtime-control timeout.
     */
    timeoutMs?: number | null
}

export interface SqlQueryResult {
    rows: SqlRow[]
    rowCount: number
    truncated: boolean
    cap: number | null
}

export interface SqlEngineSession {
    dialect: Dialect
    runQuery(sql: string, options?: SqlQueryOptions): Promise<SqlQueryResult>
    cancel(): Promise<void>
    reset(): Promise<void>
    dispose(): Promise<void>
}
