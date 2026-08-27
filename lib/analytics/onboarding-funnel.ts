import { buildFunnel, type FunnelStep } from "@/lib/analytics/funnel"

/**
 * The onboarding cohort boundary.
 *
 * Users created before this instant were backfilled as already-onboarded by
 * the V17 migration: they have `onboardingCompletedAt` set and
 * `onboardingStartedAt` null. Counting them would poison the denominator
 * permanently and make the funnel read as a catastrophic drop-off forever.
 *
 * Identifying them by `completedAt === createdAt` would also work and is
 * rejected as too clever — an explicit constant states the intent. Set to
 * the Phase 2 production deploy date, NOT the Phase 1 merge date: Phase 1
 * ships dark, so nobody could have onboarded before Phase 2 was live.
 */
export const ONBOARDING_LAUNCHED_AT = new Date("2026-09-01T00:00:00.000Z")

export type OnboardingCounts = {
    signedUp: number
    /** Reached the flow. OR-ed across all three fields so the fire-and-forget
     *  `void recordOnboardingStart()` write racing a fast skip cannot make
     *  this smaller than `completed`. */
    reached: number
    /** Answered the level question. NOT a funnel step — answering is optional
     *  by design, so it is not a subset of anything and would break
     *  monotonicity. Reported as a standalone figure. */
    answered: number
    completed: number
    /** Completed onboarding AND has at least one submission. Scoped to
     *  completers so the step is a true subset of `completed`; a cohort-wide
     *  submission count would not be. */
    submittedAfterCompleting: number
    /** Completed with no level — the definition of a deliberate skip. */
    skipped: number
}

export function buildOnboardingFunnel(counts: OnboardingCounts): FunnelStep[] {
    return buildFunnel([
        { key: "signedUp", label: "Signed up", count: counts.signedUp },
        { key: "reached", label: "Reached onboarding", count: counts.reached },
        { key: "completed", label: "Finished onboarding", count: counts.completed },
        {
            key: "submitted",
            label: "Submitted after finishing",
            count: counts.submittedAfterCompleting,
        },
    ])
}

/**
 * Null, not zero, when nobody has completed — an unknown rate and a genuine
 * 0% must not render identically.
 */
export function skipRate(counts: OnboardingCounts): number | null {
    return counts.completed === 0 ? null : counts.skipped / counts.completed
}
