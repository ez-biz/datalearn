import { prisma } from "@/lib/prisma"
import type { SqlLevel } from "@/lib/onboarding/entry-point"

/**
 * The three onboarding writes, parameterised by userId.
 *
 * NOT a server action, deliberately: every export of a "use server" module
 * becomes a client-callable RPC endpoint, so a writer taking an explicit
 * userId would let any client write onboarding state as any other user.
 * `actions/onboarding.ts` resolves the session and delegates here. Same split
 * as `lib/curriculum-write.ts`.
 */

/**
 * First write wins. A refresh must not reset the timestamp — the funnel's
 * "started" step asks when the learner first arrived, not most recently.
 * `updateMany` with the null guard makes that a single atomic statement
 * rather than a read-then-write race.
 */
export async function markOnboardingStartedForUser(userId: string): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, onboardingStartedAt: null },
        data: { onboardingStartedAt: new Date() },
    })
}

/**
 * Last write wins: a learner may go back and change their answer.
 *
 * `updateMany`, not `update`: a plain `update` throws P2025 if the row is
 * gone (deleted account, stale session), unlike its two siblings here which
 * silently no-op via `updateMany`. That inconsistency was the concrete way a
 * user could get stuck on this screen with no recovery — see WelcomeFlow's
 * error handling, which now surfaces a failed write instead of advancing.
 */
export async function recordSqlLevelForUser(
    userId: string,
    level: SqlLevel,
): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId },
        data: { sqlLevel: level },
    })
}

/**
 * Completing is terminal and first-write-wins. `level` is null for a skip,
 * and a skip must not overwrite a level the learner already chose on a
 * previous visit.
 */
export async function completeOnboardingForUser(
    userId: string,
    level: SqlLevel | null,
): Promise<void> {
    await prisma.user.updateMany({
        where: { id: userId, onboardingCompletedAt: null },
        data: {
            onboardingCompletedAt: new Date(),
            ...(level ? { sqlLevel: level } : {}),
        },
    })
}
