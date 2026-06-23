import { fork } from "node:child_process"
import { compareResults } from "./sql-validator"
import { validateContestSql } from "./contest-judge-validator"
import { resolveWorkerPath } from "./contest-judge-config"
import { enqueue, JudgeBusyError } from "./contest-judge-queue"
import type { RunResult } from "./contest-judge-engines"
import type { JudgeWorkerInput } from "./contest-judge-worker-entry"

type ContestDialect = "DUCKDB" | "POSTGRES"

export type JudgeVerdict =
    | "ACCEPTED"
    | "WRONG_ANSWER"
    | "TIME_LIMIT"
    | "MEMORY_LIMIT"
    | "RUNTIME_ERROR"
    | "COMPILE_ERROR"
    | "REJECTED"
    | "INTERNAL_ERROR"

export type JudgeOutcome = {
    verdict: JudgeVerdict
    message?: string
    userRows?: Record<string, unknown>[]
}

export type JudgeRequest = {
    dialect: ContestDialect
    userSql: string
    hiddenSchemaSql: string
    hiddenExpected: Record<string, unknown>[]
    ordered: boolean
    timeoutMs?: number
    memoryLimitMb?: number
}

const DEFAULT_TIMEOUT_MS = 10_000

// Warm-up budget. The throwaway no-op only runs `SELECT 1`, so steady-state it
// finishes in well under a second — but on a cold serverless instance the fork
// has to load the worker bundle plus the native DuckDB / PGlite binaries off a
// cold disk before the query runs, which is exactly the cost we want to absorb.
// Keep the timeout generous so that cold load is allowed to complete instead of
// being killed mid-flight (which would leave the instance only half-warm).
const DEFAULT_WARM_TIMEOUT_MS = 60_000
// How long a successful warm is trusted before another trigger re-warms. The
// win (file cache + native init) lasts the lifetime of the serverless instance,
// so this mainly debounces the burst of triggers from page loads / polling.
const DEFAULT_WARM_TTL_MS = 5 * 60_000

function warmTimeoutMs(): number {
    const raw = Number(process.env.CONTEST_JUDGE_WARM_TIMEOUT_MS)
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WARM_TIMEOUT_MS
}

function warmTtlMs(): number {
    const raw = Number(process.env.CONTEST_JUDGE_WARM_TTL_MS)
    return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_WARM_TTL_MS
}

type WarmEntry = { inFlight: Promise<void> | null; warmedAt: number }
const warmByDialect = new Map<ContestDialect, WarmEntry>()

/**
 * Pre-pay the judge's cold start. {@link submitToJudge} forks a fresh worker
 * process per submission (see `runInChild`); on a cold serverless instance the
 * very first fork loads the worker bundle and the native DuckDB / PGlite
 * binaries from a cold disk and boots the engine — tens of seconds, which the
 * first contestant to submit each problem would otherwise wait through. Running
 * one throwaway no-op judge run early warms the instance's file cache and native
 * init so the first *real* submission lands at steady-state latency.
 *
 * Idempotent and debounced per dialect: concurrent callers share a single
 * in-flight warm, and a successful warm is skipped for `CONTEST_JUDGE_WARM_TTL_MS`.
 * Never throws — warm-up is best-effort and must not break the request (page
 * load or warm ping) that triggers it.
 */
export function warmUpJudge(dialect: ContestDialect = "DUCKDB"): Promise<void> {
    const existing = warmByDialect.get(dialect)
    if (existing?.inFlight) return existing.inFlight
    if (existing && Date.now() - existing.warmedAt < warmTtlMs()) {
        return Promise.resolve()
    }

    const inFlight = (async () => {
        let warmed = false
        try {
            // Run through the same queue as real submissions so the warm fork
            // counts against CONTEST_JUDGE_CONCURRENCY instead of slipping in as
            // an invisible extra child process.
            const result = await enqueue(() =>
                runInChild({
                    dialect,
                    userSql: "SELECT 1",
                    hiddenSchemaSql: "SELECT 1;",
                    hiddenExpected: [],
                    ordered: false,
                    timeoutMs: warmTimeoutMs(),
                })
            )
            // Only a clean run means the worker actually forked and the engine
            // initialized. On failure (missing artifact, or a cold load killed
            // by the warm timeout) leave `warmedAt` stale so the next trigger
            // retries instead of waiting out the full TTL.
            warmed = result.kind === "ok"
        } catch (error) {
            // A full queue means the judge is already busy serving real
            // submissions — i.e. already warm — so treat that as success.
            warmed = error instanceof JudgeBusyError
        } finally {
            warmByDialect.set(dialect, {
                inFlight: null,
                warmedAt: warmed ? Date.now() : 0,
            })
        }
    })()

    warmByDialect.set(dialect, {
        inFlight,
        warmedAt: existing?.warmedAt ?? 0,
    })
    return inFlight
}

/** Test seam: forget every dialect's warm state so a fresh warm runs. */
export function _resetJudgeWarmStateForTests(): void {
    warmByDialect.clear()
}

export async function submitToJudge(
    request: JudgeRequest
): Promise<JudgeOutcome> {
    const validation = await validateContestSql(request.userSql, request.dialect)
    if (!validation.ok) {
        return { verdict: "REJECTED", message: validation.message }
    }

    let runResult: RunResult
    try {
        runResult = await enqueue(() => runInChild(request))
    } catch (error: unknown) {
        if (error instanceof JudgeBusyError) {
            return { verdict: "INTERNAL_ERROR", message: error.message }
        }
        return {
            verdict: "INTERNAL_ERROR",
            message: error instanceof Error ? error.message : "Judge failure",
        }
    }

    if (runResult.kind === "timeout") {
        return { verdict: "TIME_LIMIT" }
    }
    if (runResult.kind === "memory_limit") {
        return { verdict: "MEMORY_LIMIT", message: runResult.message }
    }
    if (runResult.kind === "error") {
        const message = runResult.message.toLowerCase()
        if (message.includes("syntax") || message.includes("parse")) {
            return { verdict: "COMPILE_ERROR", message: runResult.message }
        }
        return { verdict: "RUNTIME_ERROR", message: runResult.message }
    }

    const comparison = compareResults(runResult.rows, request.hiddenExpected, {
        ordered: request.ordered,
    })
    if (comparison.ok) {
        return { verdict: "ACCEPTED", userRows: runResult.rows }
    }

    return {
        verdict: "WRONG_ANSWER",
        message: comparison.reason,
        userRows: runResult.rows,
    }
}

function runInChild(request: JudgeRequest): Promise<RunResult> {
    return new Promise((resolve) => {
        let workerPath: string
        try {
            workerPath = resolveWorkerPath()
        } catch (error: unknown) {
            resolve({
                kind: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Worker artifact resolution failed",
            })
            return
        }

        const child = fork(workerPath, [], {
            cwd: process.cwd(),
            detached: false,
            env: {
                NODE_ENV: process.env.NODE_ENV ?? "production",
                PATH: process.env.PATH ?? "",
            },
            execArgv: ["--max-old-space-size=512", "--no-deprecation"],
            stdio: ["ignore", "pipe", "pipe", "ipc"],
        })

        let settled = false
        let stderr = ""
        const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS
        const timer = setTimeout(() => {
            if (settled) return
            settled = true
            try {
                child.kill("SIGKILL")
            } catch {
                // ignore kill failure
            }
            resolve({ kind: "timeout" })
        }, timeoutMs + 3_000)

        child.stderr?.on("data", (chunk) => {
            stderr += chunk.toString("utf8")
            if (stderr.length > 2_000) {
                stderr = stderr.slice(-2_000)
            }
        })

        child.on("message", (message) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve(message as RunResult)
            try {
                child.kill("SIGKILL")
            } catch {
                // ignore kill failure
            }
        })

        child.on("error", (error) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve({ kind: "error", message: error.message })
        })

        child.on("exit", (code, signal) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            if (signal === "SIGKILL") {
                resolve({ kind: "memory_limit" })
                return
            }
            resolve({
                kind: "error",
                message: `Worker exited with code ${code ?? "null"} signal ${signal ?? "none"}${stderr ? `: ${stderr}` : ""}`,
            })
        })

        const payload: JudgeWorkerInput = {
            dialect: request.dialect,
            schemaSql: request.hiddenSchemaSql,
            userSql: request.userSql,
            timeoutMs,
            memoryLimitMb: request.memoryLimitMb,
        }

        try {
            child.send(payload)
        } catch (error: unknown) {
            if (settled) return
            settled = true
            clearTimeout(timer)
            resolve({
                kind: "error",
                message:
                    error instanceof Error
                        ? error.message
                        : "Failed to send work to judge child",
            })
        }
    })
}
