"use server"

import { auth } from "@/lib/auth"
import type { SqlLevel } from "@/lib/onboarding/entry-point"
import {
    completeOnboardingForUser,
    markOnboardingStartedForUser,
    recordSqlLevelForUser,
} from "@/lib/onboarding/onboarding-write"

const LEVELS: readonly string[] = ["NEW", "INTERMEDIATE", "ADVANCED"]

/**
 * `level` arrives from a client RPC and is untrusted. An unrecognised string
 * would reach a Prisma enum column and throw a 500 rather than failing
 * cleanly, so it is validated here before any write.
 */
function asSqlLevel(value: unknown): SqlLevel | null {
    return typeof value === "string" && LEVELS.includes(value)
        ? (value as SqlLevel)
        : null
}

/**
 * `auth()` throws synchronously (not a rejected promise) when called outside
 * a request scope — e.g. from a test harness — so this is a try/catch, not a
 * `.catch()` chain. Matches the fail-closed pattern in actions/curriculum.ts.
 */
async function currentUserId(): Promise<string | null> {
    try {
        const session = await auth()
        return session?.user?.id ?? null
    } catch {
        return null
    }
}

/** Records that the learner reached screen 1. Anonymous callers no-op. */
export async function recordOnboardingStart(): Promise<void> {
    const userId = await currentUserId()
    if (!userId) return
    await markOnboardingStartedForUser(userId)
}

export async function recordSqlLevel(level: string): Promise<{ ok: boolean }> {
    const userId = await currentUserId()
    if (!userId) return { ok: false }

    const parsed = asSqlLevel(level)
    if (!parsed) return { ok: false }

    await recordSqlLevelForUser(userId, parsed)
    return { ok: true }
}

/** `level` is null for a skip. */
export async function completeOnboarding(
    level: string | null,
): Promise<{ ok: boolean }> {
    const userId = await currentUserId()
    if (!userId) return { ok: false }

    const parsed = level === null ? null : asSqlLevel(level)
    if (level !== null && !parsed) return { ok: false }

    await completeOnboardingForUser(userId, parsed)
    return { ok: true }
}
