// Pure validation for user-created (USER_CUSTOM) contests. No Prisma/React.
export const CUSTOM_LIMITS = {
    maxActivePerUser: 1,
    minProblems: 1,
    maxProblems: 20,
    minTitle: 3,
    maxTitle: 80,
    minDurationMs: 10 * 60 * 1000,
    maxDurationMs: 7 * 24 * 60 * 60 * 1000,
    minParticipants: 1,
    maxParticipants: 50,
} as const

/** A user may create a custom contest only if they have none currently active. */
export function canCreateCustomContest(activeCount: number): boolean {
    return activeCount < CUSTOM_LIMITS.maxActivePerUser
}

export type CustomContestInput = {
    title: string
    problemIds: string[]
    startsAt: Date
    endsAt: Date
    maxParticipants: number
}

export function validateCustomContestInput(
    input: CustomContestInput
): { ok: true } | { ok: false; reason: string } {
    const title = input.title?.trim() ?? ""
    if (
        title.length < CUSTOM_LIMITS.minTitle ||
        title.length > CUSTOM_LIMITS.maxTitle
    ) {
        return { ok: false, reason: "Title must be 3–80 characters." }
    }
    if (
        input.problemIds.length < CUSTOM_LIMITS.minProblems ||
        input.problemIds.length > CUSTOM_LIMITS.maxProblems
    ) {
        return { ok: false, reason: "Pick between 1 and 20 problems." }
    }
    const duration = input.endsAt.getTime() - input.startsAt.getTime()
    if (
        Number.isNaN(duration) ||
        duration < CUSTOM_LIMITS.minDurationMs ||
        duration > CUSTOM_LIMITS.maxDurationMs
    ) {
        return {
            ok: false,
            reason: "Duration must be between 10 minutes and 7 days.",
        }
    }
    if (
        input.maxParticipants < CUSTOM_LIMITS.minParticipants ||
        input.maxParticipants > CUSTOM_LIMITS.maxParticipants
    ) {
        return { ok: false, reason: "Max participants must be between 1 and 50." }
    }
    return { ok: true }
}
