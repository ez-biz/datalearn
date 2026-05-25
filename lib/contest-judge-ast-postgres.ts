import * as pgQuery from "libpg-query"

export type PostgresAstStatement = {
    stmt?: Record<string, unknown>
}

type PgParseResult = {
    stmts?: PostgresAstStatement[]
}

export async function parsePostgresSql(
    sql: string
): Promise<PostgresAstStatement[]> {
    const result = (await pgQuery.parse(sql)) as PgParseResult
    return result.stmts ?? []
}

export function walkPostgresAst(
    node: unknown,
    visit: (node: Record<string, unknown>) => void
): void {
    if (node == null) return
    if (Array.isArray(node)) {
        for (const child of node) {
            walkPostgresAst(child, visit)
        }
        return
    }
    if (typeof node !== "object") return

    visit(node as Record<string, unknown>)
    for (const value of Object.values(node)) {
        walkPostgresAst(value, visit)
    }
}
