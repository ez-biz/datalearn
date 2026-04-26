/**
 * Pure SQL-to-TableInfo parser for the constrained `CREATE TABLE` +
 * single-row `INSERT INTO ... VALUES (...)` shape used by every seeded
 * schema in this project. Lets the problem page render the Schema tab
 * and INPUT example previews server-side, removing the DuckDB-WASM
 * download from the first-paint critical path on the left pane.
 *
 * The parser deliberately handles only the shape we actually emit. Any
 * schema with multi-row VALUES, computed defaults, subqueries, or
 * unfamiliar DDL forms returns `null` from the top-level entry point so
 * the caller falls back to the existing DuckDB-introspection path.
 *
 * No external deps. Pure function. Safe to run inside a server component.
 */

export type ParsedColumn = { name: string; type: string }

export type ParsedTable = {
    name: string
    columns: ParsedColumn[]
    sampleRows: Record<string, unknown>[]
}

const SAMPLE_ROW_LIMIT = 8

/**
 * Parse a schema SQL string into a list of tables with column metadata
 * and sample rows. Returns `null` if anything looks wrong — caller must
 * fall back to a DuckDB-driven path.
 */
export function parseSchema(sql: string | null | undefined): ParsedTable[] | null {
    if (!sql || typeof sql !== "string") return null

    const stripped = stripComments(sql)
    if (!stripped.trim()) return null

    const tables = new Map<string, ParsedTable>()

    // CREATE TABLE <name> ( ... );
    const createRe = /\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"([^"]+)"|([A-Za-z_][\w]*))\s*\(([^;]+?)\)\s*;/gi
    let match: RegExpExecArray | null
    while ((match = createRe.exec(stripped)) !== null) {
        const name = match[1] ?? match[2]
        const body = match[3]
        const columns = parseColumnDefs(body)
        if (!columns) return null // unrecognized column shape — bail to fallback
        tables.set(name, { name, columns, sampleRows: [] })
    }

    if (tables.size === 0) return null

    // INSERT INTO <name> VALUES (...) ;
    const insertRe = /\bINSERT\s+INTO\s+(?:"([^"]+)"|([A-Za-z_][\w]*))\s*(?:\(([^)]*)\)\s*)?VALUES\s*\(([^;]*?)\)\s*;/gi
    while ((match = insertRe.exec(stripped)) !== null) {
        const name = match[1] ?? match[2]
        let targetCols: string[] | null = null
        if (match[3]) {
            const split = splitCommaAware(match[3])
            if (!split) return null
            targetCols = split.map((c) => c.trim().replace(/^"|"$/g, ""))
        }
        const valuesBody = match[4]
        const table = tables.get(name)
        if (!table) continue // INSERT against unknown table — skip silently
        if (table.sampleRows.length >= SAMPLE_ROW_LIMIT) continue

        const rawValues = splitCommaAware(valuesBody)
        if (!rawValues) return null

        const values = rawValues.map(parseLiteral)
        // Pair values with column names. Honor explicit (col,...) list when
        // present, else fall back to the table's column order.
        const columnNames = targetCols ?? table.columns.map((c) => c.name)
        if (values.length !== columnNames.length) return null
        const row: Record<string, unknown> = {}
        for (let i = 0; i < columnNames.length; i++) {
            row[columnNames[i]] = values[i]
        }
        table.sampleRows.push(row)
    }

    return Array.from(tables.values())
}

/** Strip line + block SQL comments. */
function stripComments(sql: string): string {
    let out = sql.replace(/\/\*[\s\S]*?\*\//g, " ")
    out = out
        .split("\n")
        .map((line) => {
            // Drop -- comments, but only when not inside a single-quoted string.
            // The seeds don't have -- inside literals; guard anyway.
            let inString = false
            for (let i = 0; i < line.length; i++) {
                const c = line[i]
                if (c === "'") inString = !inString
                if (!inString && c === "-" && line[i + 1] === "-") {
                    return line.slice(0, i)
                }
            }
            return line
        })
        .join("\n")
    return out
}

/**
 * Parse the inner content of a `CREATE TABLE foo ( ... )` body into
 * `{name, type}` pairs. Accepts standard column lines and ignores
 * table-level constraints (`PRIMARY KEY (...)`, `FOREIGN KEY ...`).
 * Returns `null` if any column line looks structurally wrong.
 */
function parseColumnDefs(body: string): ParsedColumn[] | null {
    const lines = splitCommaAware(body)
    if (!lines) return null
    const cols: ParsedColumn[] = []
    for (const raw of lines) {
        const line = raw.trim()
        if (!line) continue
        // Skip table-level constraints. Anything starting with one of these
        // is not a column.
        if (
            /^(PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(line)
        ) {
            continue
        }
        // First whitespace-delimited token is the column name (optionally
        // double-quoted). Everything after is the type, optionally with
        // modifiers (PRIMARY KEY, NOT NULL, DEFAULT ..., etc.).
        const m = line.match(/^"([^"]+)"\s+(.+)$|^([A-Za-z_][\w]*)\s+(.+)$/)
        if (!m) return null
        const name = m[1] ?? m[3]
        const rest = m[2] ?? m[4]
        // Type = rest minus trailing modifier keywords.
        const type = rest
            .replace(/\s+(PRIMARY\s+KEY|NOT\s+NULL|UNIQUE|DEFAULT\s+[^,]+).*$/i, "")
            .trim()
        cols.push({ name, type })
    }
    return cols.length ? cols : null
}

/**
 * Split a comma-separated list while respecting parentheses depth and
 * single-quoted string contents. Returns the trimmed segments, or
 * `null` if quotes/parens are unbalanced.
 */
function splitCommaAware(text: string): string[] | null {
    const out: string[] = []
    let current = ""
    let depth = 0
    let inString = false
    for (let i = 0; i < text.length; i++) {
        const c = text[i]
        if (inString) {
            // SQL escapes a single quote by doubling it: 'O''Brien'.
            if (c === "'" && text[i + 1] === "'") {
                current += "''"
                i++
                continue
            }
            if (c === "'") {
                inString = false
                current += c
                continue
            }
            current += c
            continue
        }
        if (c === "'") {
            inString = true
            current += c
            continue
        }
        if (c === "(") {
            depth++
            current += c
            continue
        }
        if (c === ")") {
            depth--
            if (depth < 0) return null
            current += c
            continue
        }
        if (c === "," && depth === 0) {
            out.push(current)
            current = ""
            continue
        }
        current += c
    }
    if (inString || depth !== 0) return null
    if (current.trim().length > 0 || out.length > 0) out.push(current)
    return out
}

/**
 * Parse a single SQL literal: string, number, NULL, boolean. Falls back
 * to the trimmed raw string if it's not one of those shapes (so e.g.
 * dates `'2023-01-15'` come back as the string they were authored as).
 */
function parseLiteral(raw: string): unknown {
    const v = raw.trim()
    if (v.length === 0) return ""
    if (/^NULL$/i.test(v)) return null
    if (/^TRUE$/i.test(v)) return true
    if (/^FALSE$/i.test(v)) return false
    if (v.startsWith("'") && v.endsWith("'") && v.length >= 2) {
        // Unescape doubled single quotes inside the literal.
        return v.slice(1, -1).replace(/''/g, "'")
    }
    // Numeric? Allow leading sign + optional decimal + optional exponent.
    if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(v)) {
        const n = Number(v)
        if (Number.isFinite(n)) return n
    }
    // Fallback — preserve as raw.
    return v
}
