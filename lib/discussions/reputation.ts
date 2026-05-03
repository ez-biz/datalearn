import type { DiscussionSettings } from "@prisma/client"
import type { ReputationTier } from "./constants"

const ACCOUNT_AGE_EVENTS = [
    { days: 7, points: 2, sourceId: "account-age:7" },
    { days: 30, points: 3, sourceId: "account-age:30" },
] as const

const MS_PER_DAY = 86_400_000

async function getPrisma() {
    return (await import("@/lib/prisma")).prisma
}

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    )
}

export function tierForScore(
    score: number,
    settings: Pick<
        DiscussionSettings,
        "trustedMinReputation" | "highTrustMinReputation"
    >
): ReputationTier {
    if (score >= settings.highTrustMinReputation) return "HIGH_TRUST"
    if (score >= settings.trustedMinReputation) return "TRUSTED"
    return "NEW"
}

export async function ensureAccountAgeEvents(
    userId: string,
    createdAt: Date
): Promise<void> {
    const prisma = await getPrisma()
    const ageMs = Date.now() - createdAt.getTime()

    for (const event of ACCOUNT_AGE_EVENTS) {
        if (ageMs < event.days * MS_PER_DAY) continue

        try {
            await prisma.userReputationEvent.create({
                data: {
                    userId,
                    kind: "ACCOUNT_AGE_BONUS",
                    sourceId: event.sourceId,
                    points: event.points,
                },
            })
        } catch (error) {
            if (!isUniqueConstraintError(error)) throw error
        }
    }
}

export async function getUserReputation(
    userId: string,
    settings: DiscussionSettings
): Promise<{ score: number; tier: ReputationTier }> {
    const prisma = await getPrisma()
    const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { createdAt: true },
    })

    await ensureAccountAgeEvents(userId, user.createdAt)

    const aggregate = await prisma.userReputationEvent.aggregate({
        where: { userId },
        _sum: { points: true },
    })
    const score = aggregate._sum.points ?? 0

    return {
        score,
        tier: tierForScore(score, settings),
    }
}
