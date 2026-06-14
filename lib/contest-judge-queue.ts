const CONCURRENCY = Number(process.env.CONTEST_JUDGE_CONCURRENCY ?? "4")
const MAX_QUEUE_DEPTH = Number(process.env.CONTEST_JUDGE_QUEUE_LIMIT ?? "100")

let inFlight = 0
const pending: Array<() => void> = []

export class JudgeBusyError extends Error {
    constructor() {
        super("Judge queue full")
        this.name = "JudgeBusyError"
    }
}

export async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    if (inFlight < CONCURRENCY) {
        inFlight++
    } else {
        if (pending.length >= MAX_QUEUE_DEPTH) {
            throw new JudgeBusyError()
        }
        await new Promise<void>((resolve) => pending.push(resolve))
    }

    try {
        return await fn()
    } finally {
        const next = pending.shift()
        if (next) {
            next()
        } else {
            inFlight--
        }
    }
}

export function _resetQueueForTests(): void {
    inFlight = 0
    pending.length = 0
}

export function _queueInternalsForTests(): {
    inFlight: number
    pendingDepth: number
    CONCURRENCY: number
    MAX_QUEUE_DEPTH: number
} {
    return { inFlight, pendingDepth: pending.length, CONCURRENCY, MAX_QUEUE_DEPTH }
}
