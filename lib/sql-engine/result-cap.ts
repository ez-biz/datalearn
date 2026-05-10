import type { SqlRow, SqlQueryResult } from "./types"

export const DEFAULT_DISPLAY_ROW_CAP = 1_000
export const DEFAULT_VALIDATE_ROW_CAP = 1_000

export function computeValidateRowCap(
    expectedRowCount: number | null | undefined,
    floor = DEFAULT_VALIDATE_ROW_CAP
): number {
    const safeExpected =
        typeof expectedRowCount === "number" && Number.isFinite(expectedRowCount)
            ? Math.max(0, Math.floor(expectedRowCount))
            : 0
    return Math.max(safeExpected * 2, floor)
}

export function applyRowCap(
    rows: SqlRow[],
    cap: number | null | undefined
): SqlQueryResult {
    const normalizedCap = normalizeRowCap(cap)
    if (normalizedCap === null) {
        return {
            rows,
            rowCount: rows.length,
            truncated: false,
            cap: null,
        }
    }

    const truncated = rows.length > normalizedCap
    return {
        rows: truncated ? rows.slice(0, normalizedCap) : rows,
        rowCount: rows.length,
        truncated,
        cap: normalizedCap,
    }
}

export function limitQueryResultForDisplay(
    result: SqlQueryResult,
    displayCap = DEFAULT_DISPLAY_ROW_CAP
): SqlQueryResult {
    const capped = applyRowCap(result.rows, displayCap)
    return {
        rows: capped.rows,
        rowCount: result.rowCount,
        truncated: result.truncated || capped.truncated,
        cap: capped.cap,
    }
}

export function toRowLimitedSql(
    sql: string,
    cap: number | null | undefined
): string {
    const normalizedCap = normalizeRowCap(cap)
    const trimmed = stripTrailingSemicolon(sql.trim())
    if (normalizedCap === null || !shouldWrapForLimit(trimmed)) return trimmed

    return `SELECT * FROM (${trimmed}) AS dl_row_cap LIMIT ${normalizedCap + 1}`
}

function normalizeRowCap(cap: number | null | undefined): number | null {
    if (cap === null || cap === undefined) return null
    if (!Number.isFinite(cap)) return null
    return Math.max(0, Math.floor(cap))
}

function stripTrailingSemicolon(sql: string): string {
    return sql.replace(/(?:;\s*)+$/, "")
}

function shouldWrapForLimit(sql: string): boolean {
    return /^(select|with|values)\b/i.test(sql)
}
