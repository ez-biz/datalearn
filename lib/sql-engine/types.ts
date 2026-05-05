export type Dialect = "DUCKDB" | "POSTGRES"
export type SqlRow = Record<string, unknown>

export interface SqlEngineSession {
    dialect: Dialect
    runQuery(sql: string): Promise<SqlRow[]>
    dispose(): Promise<void>
}
