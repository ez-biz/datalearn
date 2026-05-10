export type SqlRow = Record<string, unknown>

export function normalizeSqlCell(value: unknown): unknown {
    if (value === null || value === undefined) return null

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value.toISOString()
    }

    if (typeof value === "bigint") {
        if (
            value <= BigInt(Number.MAX_SAFE_INTEGER) &&
            value >= BigInt(Number.MIN_SAFE_INTEGER)
        ) {
            return Number(value)
        }
        return value.toString()
    }

    if (typeof value === "object" && value !== null) {
        const maybeJson = value as { toJSON?: () => unknown }
        if (typeof maybeJson.toJSON === "function") {
            return normalizeSqlCell(maybeJson.toJSON())
        }

        const rendered = String(value)
        if (rendered !== "[object Object]") return rendered
    }

    return value
}

export function normalizeSqlRow(row: SqlRow): SqlRow {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
            key,
            normalizeSqlCell(value),
        ])
    )
}

export function normalizeSqlRows(rows: SqlRow[]): SqlRow[] {
    return rows.map(normalizeSqlRow)
}
