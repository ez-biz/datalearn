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
 * Approach: strip comments, split on `;`, check the first token of each
 * statement against an allow-list. Handles 99% of accidental and
 * adversarial inputs. The remaining 1% is CTE-wrapped DML
 * (`WITH x AS (DELETE FROM t RETURNING *) SELECT * FROM x`) — covered by
 * a secondary scan that flags DML keywords appearing INSIDE a CTE.
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
 * Tokens that indicate a write operation. Used to catch CTE-wrapped DML
 * (Postgres only — `WITH cte AS (DELETE …) SELECT * FROM cte`) which a
 * first-keyword check would otherwise pass.
 */
const WRITE_TOKENS = new Set([
    "INSERT",
    "UPDATE",
    "DELETE",
    "MERGE",
    "UPSERT",
    "REPLACE",
])
const WRITE_TOKEN_PATTERN = new RegExp(
    `\\b(${[...WRITE_TOKENS].join("|")})\\b`,
    "i"
)

export type SqlGuardResult =
    | { ok: true }
    | {
          ok: false
          /** First-token of the offending statement, e.g. `"DROP"`. */
          rejected: string
          /** User-facing message, ready to display in the workspace error UI. */
          reason: string
      }

/**
 * Strip line and block comments. We do NOT try to handle string literals
 * containing comment markers (`SELECT 'a -- b'`) because the regex
 * below operates on uncomment-safe sequences only — strings inside
 * statements aren't relevant for the first-keyword check we're doing
 * downstream.
 */
function stripComments(sql: string): string {
    return sql
        .replace(/--.*$/gm, "") // line comments
        .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
}

/**
 * Return the uppercased first word of a SQL statement (after whitespace).
 * Returns null for empty / whitespace-only input.
 */
function firstKeyword(stmt: string): string | null {
    const m = stmt.match(/^\s*([a-zA-Z_]+)/)
    return m ? m[1].toUpperCase() : null
}

/**
 * Returns the first WRITE_TOKENS keyword (uppercased) appearing as a
 * standalone word in the statement, or null if none. Used to catch
 * CTE-wrapped DML.
 */
function findWriteKeyword(stmt: string): string | null {
    // \b word boundaries so column names like `last_updated` don't trip
    // the UPDATE check.
    const m = stmt.match(WRITE_TOKEN_PATTERN)
    return m ? m[1].toUpperCase() : null
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
    const stripped = stripComments(sql)
    const statements = stripped
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

    if (statements.length === 0) return { ok: true } // empty input — engine handles

    for (const stmt of statements) {
        const first = firstKeyword(stmt)
        if (!first) continue

        if (!ALLOWED_FIRST_KEYWORDS.has(first)) {
            return {
                ok: false,
                rejected: first,
                reason: `${first} statements aren't allowed in the workspace — only SELECT queries are permitted. (Run + Submit both run against the seed schema; mutating it would break subsequent queries and undermine the validator.)`,
            }
        }

        // Defensive: catch CTE-wrapped DML (Postgres allows it). The
        // first-keyword check passes WITH; we still want to block
        // INSERT/UPDATE/DELETE/MERGE inside the CTE body.
        if (first === "WITH") {
            const writeKw = findWriteKeyword(stmt)
            if (writeKw) {
                return {
                    ok: false,
                    rejected: writeKw,
                    reason: `${writeKw} inside a WITH-clause isn't allowed in the workspace — only SELECT queries (including SELECT-CTEs) are permitted.`,
                }
            }
        }
    }

    return { ok: true }
}
