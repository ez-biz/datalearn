import { DuckDBInstance } from "@duckdb/node-api"
import { PGlite } from "@electric-sql/pglite"

export type RunInput = {
    schemaSql: string
    userSql: string
    timeoutMs: number
    memoryLimitMb?: number
}

export type RunResult =
    | { kind: "ok"; rows: Record<string, unknown>[] }
    | { kind: "error"; message: string }
    | { kind: "timeout" }
    | { kind: "memory_limit"; message?: string }

const DEFAULT_MEMORY_MB = 256

function duckDBPrelude(memoryMb: number): string[] {
    return [
        `SET memory_limit = '${memoryMb}MB';`,
        "SET threads = 1;",
        "SET allow_unsigned_extensions = false;",
        "SET autoinstall_known_extensions = false;",
        "SET autoload_known_extensions = false;",
        "SET enable_external_access = false;",
        "SET disabled_filesystems = 'LocalFileSystem,HTTPFileSystem,S3FileSystem';",
        "SET lock_configuration = true;",
    ]
}

export async function runDuckDBQuery(input: RunInput): Promise<RunResult> {
    const instance = await DuckDBInstance.create(":memory:")
    const connection = await instance.connect()

    try {
        for (const statement of duckDBPrelude(
            input.memoryLimitMb ?? DEFAULT_MEMORY_MB
        )) {
            await connection.run(statement)
        }

        await connection.run(input.schemaSql)

        if (input.timeoutMs <= 0) {
            return { kind: "timeout" }
        }

        return await withTimeout(
            (async () => {
                const reader = await connection.runAndReadAll(input.userSql)
                return {
                    kind: "ok" as const,
                    rows: reader.getRowObjects() as Record<string, unknown>[],
                }
            })(),
            input.timeoutMs,
            () => {
                try {
                    connection.interrupt()
                } catch {
                    // ignore interrupt failure
                }
            }
        )
    } catch (error: unknown) {
        return { kind: "error", message: errorMessage(error) }
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

export async function runPGliteQuery(input: RunInput): Promise<RunResult> {
    const db = new PGlite()

    try {
        await db.exec(input.schemaSql)

        if (input.timeoutMs <= 0) {
            return { kind: "timeout" }
        }

        await db.exec(`SET statement_timeout = '${input.timeoutMs}ms'`)

        return await withTimeout(
            (async () => {
                const result = await db.query(input.userSql)
                return {
                    kind: "ok" as const,
                    rows: result.rows as Record<string, unknown>[],
                }
            })(),
            input.timeoutMs
        )
    } catch (error: unknown) {
        return { kind: "error", message: errorMessage(error) }
    } finally {
        await db.close().catch(() => {})
    }
}

async function withTimeout<T extends RunResult>(
    promise: Promise<T>,
    timeoutMs: number,
    onTimeout?: () => void
): Promise<T | { kind: "timeout" }> {
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<{ kind: "timeout" }>((resolve) => {
        timer = setTimeout(() => {
            onTimeout?.()
            resolve({ kind: "timeout" })
        }, timeoutMs)
    })

    try {
        return await Promise.race([promise, timeout])
    } finally {
        if (timer) clearTimeout(timer)
    }
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "unknown error"
}
