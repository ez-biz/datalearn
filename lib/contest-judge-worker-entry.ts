import {
    runDuckDBQuery,
    runPGliteQuery,
    type RunResult,
} from "./contest-judge-engines"

export type JudgeWorkerInput = {
    dialect: "DUCKDB" | "POSTGRES"
    schemaSql: string
    userSql: string
    timeoutMs: number
    memoryLimitMb?: number
}

export async function handleJudgeWorkerInput(
    input: JudgeWorkerInput
): Promise<RunResult> {
    try {
        return input.dialect === "DUCKDB"
            ? await runDuckDBQuery(input)
            : await runPGliteQuery(input)
    } catch (error: unknown) {
        return {
            kind: "error",
            message: error instanceof Error ? error.message : "worker crash",
        }
    }
}

function sendResult(result: RunResult): void {
    if (typeof process.send === "function") {
        process.send(result)
    } else {
        process.stdout.write(`${JSON.stringify(result)}\n`)
    }
}

if (typeof process.send === "function") {
    process.once("message", async (message) => {
        const result = await handleJudgeWorkerInput(message as JudgeWorkerInput)
        sendResult(result)
        process.exit(0)
    })
} else if (!process.env.CONTEST_JUDGE_WORKER_NO_STDIN) {
    let body = ""
    process.stdin.setEncoding("utf8")
    process.stdin.on("data", (chunk) => {
        body += chunk
    })
    process.stdin.on("end", async () => {
        const result = await handleJudgeWorkerInput(
            JSON.parse(body) as JudgeWorkerInput
        )
        sendResult(result)
        process.exit(0)
    })
}
