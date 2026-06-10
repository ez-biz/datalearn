import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

const PER_MINUTE = 10
const PER_DAY = 50

type UploadRateClient = Pick<Prisma.TransactionClient, "asset">

export interface RateLimitResult {
    ok: boolean
    retryAfterMs?: number
}

// Every upload attempt that passes this check writes an Asset row in the
// same request, so counting recent rows is the durable equivalent of the
// old in-process window buckets (which reset per serverless instance).
async function windowRetryAfter(
    client: UploadRateClient,
    userId: string,
    windowMs: number,
    limit: number,
    now: number
): Promise<number | null> {
    const since = new Date(now - windowMs)
    const count = await client.asset.count({
        where: { ownerId: userId, createdAt: { gte: since } },
    })
    if (count < limit) {
        return null
    }

    // A slot frees up when the Nth-most-recent row ages out of the window.
    const nthNewest = await client.asset.findFirst({
        where: { ownerId: userId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        skip: limit - 1,
        select: { createdAt: true },
    })
    const oldestCounted = nthNewest?.createdAt.getTime() ?? now
    return Math.max(windowMs - (now - oldestCounted), 0)
}

export async function checkUploadRate(
    userId: string,
    client: UploadRateClient = prisma
): Promise<RateLimitResult> {
    const now = Date.now()

    const minuteRetry = await windowRetryAfter(
        client,
        userId,
        MINUTE_MS,
        PER_MINUTE,
        now
    )
    if (minuteRetry !== null) {
        return { ok: false, retryAfterMs: minuteRetry }
    }

    const dayRetry = await windowRetryAfter(client, userId, DAY_MS, PER_DAY, now)
    if (dayRetry !== null) {
        return { ok: false, retryAfterMs: dayRetry }
    }

    return { ok: true }
}
