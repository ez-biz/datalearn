import { denylistFor } from "./contest-judge-denylist"
import {
    DuckDBSqlAstError,
    parseDuckDBSql,
    walkDuckDBAst,
} from "./contest-judge-ast-duckdb"
import {
    parsePostgresSql,
    walkPostgresAst,
} from "./contest-judge-ast-postgres"

export type ValidatorOk = { ok: true }
export type ValidatorReject = {
    ok: false
    reasonCode:
        | "SIZE_LIMIT"
        | "UNSUPPORTED_STATEMENT"
        | "FORBIDDEN_FUNCTION"
        | "PARSE_ERROR"
    message: string
}
export type ValidatorResult = ValidatorOk | ValidatorReject

type ContestDialect = "DUCKDB" | "POSTGRES"

export const MAX_SQL_BYTES = 64 * 1024

export async function validateContestSql(
    sql: string,
    dialect: ContestDialect
): Promise<ValidatorResult> {
    if (Buffer.byteLength(sql, "utf8") > MAX_SQL_BYTES) {
        return {
            ok: false,
            reasonCode: "SIZE_LIMIT",
            message: `SQL exceeds ${MAX_SQL_BYTES} bytes`,
        }
    }

    return dialect === "DUCKDB"
        ? validateDuckDB(sql)
        : validatePostgres(sql)
}

const DUCKDB_ALLOWED_TOP: ReadonlySet<string> = new Set(["SELECT_NODE"])

async function validateDuckDB(sql: string): Promise<ValidatorResult> {
    let statements: unknown[]
    try {
        statements = await parseDuckDBSql(sql)
    } catch (error: unknown) {
        if (error instanceof DuckDBSqlAstError) {
            return {
                ok: false,
                reasonCode:
                    error.kind === "parse" ? "PARSE_ERROR" : "UNSUPPORTED_STATEMENT",
                message: error.message,
            }
        }

        return {
            ok: false,
            reasonCode: "PARSE_ERROR",
            message: (error as Error).message ?? "DuckDB SQL parse failure",
        }
    }

    if (statements.length === 0) {
        return {
            ok: false,
            reasonCode: "PARSE_ERROR",
            message: "Empty SQL",
        }
    }
    if (statements.length > 1) {
        return {
            ok: false,
            reasonCode: "UNSUPPORTED_STATEMENT",
            message: "Multiple statements are not allowed",
        }
    }

    const statement = statements[0] as Record<string, unknown>
    const node = statement.node as Record<string, unknown> | undefined
    const topType = typeof node?.type === "string" ? node.type : ""
    if (!DUCKDB_ALLOWED_TOP.has(topType)) {
        return {
            ok: false,
            reasonCode: "UNSUPPORTED_STATEMENT",
            message: `Top-level statement "${topType || "unknown"}" is not allowed`,
        }
    }

    const denylist = denylistFor("DUCKDB")
    let forbiddenFunction: string | null = null
    walkDuckDBAst(node, (astNode) => {
        if (forbiddenFunction) return
        const functionName =
            typeof astNode.function_name === "string"
                ? astNode.function_name.toLowerCase()
                : ""
        if (functionName && denylist.has(functionName)) {
            forbiddenFunction = functionName
        }
    })

    if (forbiddenFunction) {
        return {
            ok: false,
            reasonCode: "FORBIDDEN_FUNCTION",
            message: `Function "${forbiddenFunction}" is not allowed`,
        }
    }

    return { ok: true }
}

const PG_FORBIDDEN_NODES: ReadonlySet<string> = new Set([
    "InsertStmt",
    "UpdateStmt",
    "DeleteStmt",
    "MergeStmt",
    "TruncateStmt",
    "CreateStmt",
    "DropStmt",
    "AlterStmt",
    "AlterTableStmt",
    "RenameStmt",
    "GrantStmt",
    "RevokeStmt",
    "CommentStmt",
    "SecLabelStmt",
    "CopyStmt",
    "PrepareStmt",
    "ExecuteStmt",
    "DeallocateStmt",
    "VariableSetStmt",
    "VariableShowStmt",
    "TransactionStmt",
    "LockStmt",
    "VacuumStmt",
    "AnalyzeStmt",
    "LoadStmt",
    "DiscardStmt",
    "ListenStmt",
    "NotifyStmt",
    "UnlistenStmt",
    "DoStmt",
    "CallStmt",
    "CreateExtensionStmt",
    "AlterExtensionStmt",
    "DropExtensionStmt",
])

async function validatePostgres(sql: string): Promise<ValidatorResult> {
    let statements
    try {
        statements = await parsePostgresSql(sql)
    } catch (error: unknown) {
        return {
            ok: false,
            reasonCode: "PARSE_ERROR",
            message: (error as Error).message ?? "Postgres SQL parse failure",
        }
    }

    if (statements.length === 0) {
        return {
            ok: false,
            reasonCode: "PARSE_ERROR",
            message: "Empty SQL",
        }
    }
    if (statements.length > 1) {
        return {
            ok: false,
            reasonCode: "UNSUPPORTED_STATEMENT",
            message: "Multiple statements are not allowed",
        }
    }

    const top = statements[0].stmt ?? {}
    if (!("SelectStmt" in top)) {
        const topKey = Object.keys(top)[0] ?? "unknown"
        return {
            ok: false,
            reasonCode: "UNSUPPORTED_STATEMENT",
            message: `Top-level statement "${topKey}" is not allowed`,
        }
    }

    const denylist = denylistFor("POSTGRES")
    let forbiddenNode: string | null = null
    let forbiddenFunction: string | null = null

    walkPostgresAst(top, (astNode) => {
        if (forbiddenNode || forbiddenFunction) return
        for (const key of Object.keys(astNode)) {
            if (PG_FORBIDDEN_NODES.has(key)) {
                forbiddenNode = key
                return
            }
        }

        if ("FuncCall" in astNode) {
            const functionName = getPostgresFunctionName(astNode.FuncCall)
            if (functionName && denylist.has(functionName)) {
                forbiddenFunction = functionName
            }
        }
    })

    if (forbiddenFunction) {
        return {
            ok: false,
            reasonCode: "FORBIDDEN_FUNCTION",
            message: `Function "${forbiddenFunction}" is not allowed`,
        }
    }
    if (forbiddenNode) {
        return {
            ok: false,
            reasonCode: "UNSUPPORTED_STATEMENT",
            message: `Node "${forbiddenNode}" is not allowed`,
        }
    }

    return { ok: true }
}

function getPostgresFunctionName(funcCall: unknown): string | null {
    if (!funcCall || typeof funcCall !== "object") return null
    const funcname = (funcCall as { funcname?: unknown[] }).funcname
    if (!Array.isArray(funcname) || funcname.length === 0) return null

    const last = funcname.at(-1)
    if (!last || typeof last !== "object") return null
    const stringNode = (last as { String?: { sval?: unknown }; str?: unknown })
        .String
    const value = stringNode?.sval ?? (last as { str?: unknown }).str
    return typeof value === "string" ? value.toLowerCase() : null
}
