export const DEFAULT_QUERY_TIMEOUT_MS = 10_000

const TIMEOUT_MESSAGE = "Query timed out - engine session was reset."

export class QueryTimeoutError extends Error {
    readonly name = "QueryTimeoutError"

    constructor(message = TIMEOUT_MESSAGE) {
        super(message)
    }
}

export function isQueryTimeoutError(error: unknown): error is QueryTimeoutError {
    return error instanceof QueryTimeoutError
}

export async function runWithTimeout<T>({
    operation,
    timeoutMs = DEFAULT_QUERY_TIMEOUT_MS,
    onTimeout,
}: {
    operation: () => Promise<T>
    timeoutMs?: number
    onTimeout?: () => Promise<void>
}): Promise<T> {
    const normalizedTimeout = normalizeTimeoutMs(timeoutMs)
    let timer: ReturnType<typeof setTimeout> | null = null

    try {
        return await Promise.race([
            operation(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new QueryTimeoutError())
                }, normalizedTimeout)
            }),
        ])
    } catch (error) {
        if (isQueryTimeoutError(error)) {
            await onTimeout?.()
        }
        throw error
    } finally {
        if (timer) clearTimeout(timer)
    }
}

function normalizeTimeoutMs(timeoutMs: number): number {
    if (!Number.isFinite(timeoutMs)) return DEFAULT_QUERY_TIMEOUT_MS
    return Math.max(1, Math.floor(timeoutMs))
}
