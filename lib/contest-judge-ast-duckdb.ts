type DuckDBApi = typeof import("@duckdb/node-api")
type DuckDBInstanceType = DuckDBApi["DuckDBInstance"]

export type DuckDBAstNode = Record<string, unknown> | unknown[]

export class DuckDBSqlAstError extends Error {
    constructor(
        message: string,
        readonly kind: "parse" | "unsupported"
    ) {
        super(message)
        this.name = "DuckDBSqlAstError"
    }
}

type DuckDBSerializedSql = {
    error?: boolean
    error_type?: string
    error_message?: string
    statements?: DuckDBAstNode[]
}

export async function parseDuckDBSql(sql: string): Promise<DuckDBAstNode[]> {
    const DuckDBInstance = await loadDuckDBInstance()
    const instance = await DuckDBInstance.create(":memory:")
    const connection = await instance.connect()

    try {
        const reader = await connection.runAndReadAll(
            "SELECT json_serialize_sql(?::VARCHAR) AS ast_json",
            [sql]
        )
        const rows = reader.getRowObjects() as Array<{ ast_json: string }>
        const serialized = JSON.parse(rows[0]?.ast_json ?? "{}") as DuckDBSerializedSql

        if (serialized.error) {
            const message = serialized.error_message ?? "DuckDB SQL parse failure"
            const kind =
                serialized.error_type === "parser" || serialized.error_type === "syntax"
                    ? "parse"
                    : "unsupported"
            throw new DuckDBSqlAstError(message, kind)
        }

        return serialized.statements ?? []
    } finally {
        try {
            connection.disconnectSync()
        } catch {
            // ignore cleanup failure
        }
        try {
            ;(instance as unknown as { terminateSync?: () => void }).terminateSync?.()
        } catch {
            // ignore cleanup failure
        }
    }
}

async function loadDuckDBInstance(): Promise<DuckDBInstanceType> {
    const dynamicImport = new Function(
        "specifier",
        "return import(specifier)"
    ) as (specifier: string) => Promise<DuckDBApi>
    const module = await dynamicImport("@duckdb/node-api")
    return module.DuckDBInstance
}

export function walkDuckDBAst(
    node: unknown,
    visit: (node: Record<string, unknown>) => void
): void {
    if (node == null) return
    if (Array.isArray(node)) {
        for (const child of node) {
            walkDuckDBAst(child, visit)
        }
        return
    }
    if (typeof node !== "object") return

    visit(node as Record<string, unknown>)
    for (const value of Object.values(node)) {
        walkDuckDBAst(value, visit)
    }
}
