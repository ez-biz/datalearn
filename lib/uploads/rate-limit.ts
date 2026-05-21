const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

const PER_MINUTE = 10
const PER_DAY = 50

interface WindowBucket {
    minute: number[]
    day: number[]
}

const buckets = new Map<string, WindowBucket>()

export interface RateLimitResult {
    ok: boolean
    retryAfterMs?: number
}

export function checkUploadRate(userId: string): RateLimitResult {
    const now = Date.now()
    const bucket = buckets.get(userId) ?? { minute: [], day: [] }
    bucket.minute = bucket.minute.filter((time) => now - time < MINUTE_MS)
    bucket.day = bucket.day.filter((time) => now - time < DAY_MS)

    if (bucket.minute.length >= PER_MINUTE) {
        buckets.set(userId, bucket)
        return {
            ok: false,
            retryAfterMs: MINUTE_MS - (now - bucket.minute[0]),
        }
    }

    if (bucket.day.length >= PER_DAY) {
        buckets.set(userId, bucket)
        return {
            ok: false,
            retryAfterMs: DAY_MS - (now - bucket.day[0]),
        }
    }

    bucket.minute.push(now)
    bucket.day.push(now)
    buckets.set(userId, bucket)
    return { ok: true }
}

export function _resetRateLimits(): void {
    buckets.clear()
}
