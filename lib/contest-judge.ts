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
