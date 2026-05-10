/**
 * Static guard that blocks DDL / DML / DCL / transaction-control / engine-
 * extension statements from running in the learner workspace.
 *
 * Why guard at all when validation is server-side?
 *  1. Cheating prevention. The in-browser engine state IS the seed data the
 *     learner's queries see. A `DROP TABLE customers` followed by manual
 *     INSERTs lets a learner construct rows that exactly match
 *     `expectedOutput` without writing a real solution. The validator
 *     compares result rows; it can't tell the difference between a row
 *     produced by a clever JOIN and a row hand-crafted via INSERT.
 *  2. Workspace integrity. A successful DROP wipes the schema for the
 *     learner's session — every subsequent Run hits "table not found"
 *     until they refresh. Confusing failure mode.
 *  3. Pedagogical clarity. The product is "practice SELECT against real
 *     schemas." Letting people CREATE / ALTER / GRANT muddies the lesson.
 *
 * What's allowed:
 *   - SELECT (and CTE variants `WITH … SELECT …`)
 *   - VALUES (...) (Postgres / DuckDB inline literal queries)
 *   - EXPLAIN / EXPLAIN ANALYZE — read-only diagnostics
 *   - DESCRIBE / DESC — DuckDB schema introspection
 *   - SHOW — informational queries
 *
 * What's blocked:
 *   - DDL: CREATE, ALTER, DROP, TRUNCATE, RENAME, COMMENT, REINDEX, VACUUM
 *   - DML: INSERT, UPDATE, DELETE, MERGE, REPLACE, UPSERT, COPY
 *   - DCL: GRANT, REVOKE
 *   - Transaction: BEGIN, START, COMMIT, ROLLBACK, SAVEPOINT, RELEASE
 *   - Engine extensions / config: SET, RESET, PRAGMA, ATTACH, DETACH,
 *     INSTALL, LOAD, USE
 *   - Procedure execution: CALL, EXEC, EXECUTE, DO
 *
 * Approach: tokenize SQL just enough to ignore comments, string literals,
 * quoted identifiers, and dollar-quoted literals before splitting statements
 * on `;` and checking keyword tokens. This is not a full SQL parser; it is a
 * defensive preflight before the browser database parses the query.
 */

const ALLOWED_FIRST_KEYWORDS = new Set([
    "SELECT",
    "WITH",
    "VALUES",
    "EXPLAIN",
    "DESCRIBE",
    "DESC",
    "SHOW",
    "TABLE", // DuckDB shorthand for `SELECT * FROM <table>` — read-only
    "FROM", // DuckDB pipe-style; rare but read-only
])

/**
 * Tokens that indicate a write operation when nested inside an otherwise
 * allowed statement shape. This catches CTE-wrapped DML and mutating queries
 * wrapped by EXPLAIN ANALYZE.
 */
const WRITE_TOKENS = new Set([
    "COPY",
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "UPSERT",
    "REPLACE",
])

export type SqlGuardResult =
    | { ok: true }
    | {
          ok: false
          /** First-token of the offending statement, e.g. `"DROP"`. */
          rejected: string
          /** User-facing message, ready to display in the workspace error UI. */
          reason: string
      }

type SqlStatement = {
    tokens: string[]
}

/**
 * Return uppercased keyword-like tokens for each semicolon-delimited statement.
 * Semicolons and words inside comments, string literals, quoted identifiers,
 * and dollar-quoted literals are ignored because they are data, not SQL
 * control flow.
 */
function tokenizeStatements(sql: string): SqlStatement[] {
    const statements: SqlStatement[] = []
    let tokens: string[] = []
    let i = 0

    function pushStatement() {
        if (tokens.length > 0) {
            statements.push({ tokens })
            tokens = []
        }
    }

    while (i < sql.length) {
        const ch = sql[i]
        const next = sql[i + 1]

        if (ch === "'") {
            i = consumeSingleQuotedString(sql, i)
            continue
        }

        if (ch === '"') {
            i = consumeDoubleQuotedIdentifier(sql, i)
            continue
        }

        if (ch === "-" && next === "-") {
            i = consumeLineComment(sql, i)
            continue
        }

        if (ch === "/" && next === "*") {
            i = consumeBlockComment(sql, i)
            continue
        }

        if (ch === "$") {
            const nextIndex = consumeDollarQuotedString(sql, i)
            if (nextIndex !== i) {
                i = nextIndex
                continue
            }
        }

        if (ch === ";") {
            pushStatement()
            i++
            continue
        }

        if (isIdentifierStart(ch)) {
            const start = i
            i++
            while (isIdentifierPart(sql[i])) i++
            tokens.push(sql.slice(start, i).toUpperCase())
            continue
        }

        i++
    }

    pushStatement()
    return statements
}

function isIdentifierStart(ch: string | undefined): boolean {
    return typeof ch === "string" && /^[A-Za-z_]$/.test(ch)
}

function isIdentifierPart(ch: string | undefined): boolean {
    return typeof ch === "string" && /^[A-Za-z0-9_$]$/.test(ch)
}

function consumeSingleQuotedString(sql: string, index: number): number {
    let i = index + 1
    while (i < sql.length) {
        if (sql[i] === "'") {
            if (sql[i + 1] === "'") {
                i += 2
                continue
            }

            return i + 1
        }

        i++
    }

    return i
}

function consumeDoubleQuotedIdentifier(sql: string, index: number): number {
    let i = index + 1
    while (i < sql.length) {
        if (sql[i] === '"') {
            if (sql[i + 1] === '"') {
                i += 2
                continue
            }

            return i + 1
        }

        i++
    }

    return i
}

function consumeLineComment(sql: string, index: number): number {
    const newline = sql.indexOf("\n", index + 2)
    return newline === -1 ? sql.length : newline + 1
}

function consumeBlockComment(sql: string, index: number): number {
    let depth = 1
    let i = index + 2

    while (i < sql.length && depth > 0) {
        if (sql[i] === "/" && sql[i + 1] === "*") {
            depth++
            i += 2
            continue
        }

        if (sql[i] === "*" && sql[i + 1] === "/") {
            depth--
            i += 2
            continue
        }

        i++
    }

    return i
}

function consumeDollarQuotedString(sql: string, index: number): number {
    const delimiter = dollarQuoteDelimiter(sql, index)
    if (!delimiter) return index

    const end = sql.indexOf(delimiter, index + delimiter.length)
    return end === -1 ? sql.length : end + delimiter.length
}

function dollarQuoteDelimiter(sql: string, index: number): string | null {
    const match = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(
        sql.slice(index)
    )
    return match ? match[0] : null
}

/**
 * Returns the first WRITE_TOKENS keyword (uppercased) appearing as a
 * standalone token in the statement, or null if none. Used to catch
 * CTE-wrapped DML and mutating statements wrapped by EXPLAIN ANALYZE.
 */
function findWriteKeyword(tokens: string[]): string | null {
    return tokens.find((token) => WRITE_TOKENS.has(token)) ?? null
}

function writeKeywordReason(first: string, writeKw: string): string {
    if (first === "WITH") {
        return `${writeKw} inside a WITH-clause isn't allowed in the workspace — only SELECT queries (including SELECT-CTEs) are permitted.`
    }

    if (first === "EXPLAIN") {
        return `${writeKw} inside EXPLAIN isn't allowed in the workspace — only read-only query plans are permitted.`
    }

    return `${writeKw} inside a read-only query isn't allowed in the workspace — only SELECT queries are permitted.`
}

/**
 * Validate that the user's SQL is read-only. Returns `{ok: true}` for
 * permitted queries and a structured rejection for anything else.
 *
 * The error message is workspace-ready: "DROP statements aren't allowed
 * in the workspace — only SELECT queries are permitted." Don't wrap or
 * prepend; render verbatim.
 */
export function checkReadOnlyQuery(sql: string): SqlGuardResult {
    const statements = tokenizeStatements(sql)

    if (statements.length === 0) return { ok: true } // empty input — engine handles

    for (const statement of statements) {
        const [first, ...rest] = statement.tokens
        if (!first) continue

        if (!ALLOWED_FIRST_KEYWORDS.has(first)) {
            return {
                ok: false,
                rejected: first,
                reason: `${first} statements aren't allowed in the workspace — only SELECT queries are permitted. (Run + Submit both run against the seed schema; mutating it would break subsequent queries and undermine the validator.)`,
            }
        }

        const writeKw = findWriteKeyword(rest)
        if (writeKw) {
            return {
                ok: false,
                rejected: writeKw,
                reason: writeKeywordReason(first, writeKw),
            }
        }
    }

    return { ok: true }
}
