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
    /** Completed onboarding AND has at least one submission, ever. Scoped to
     *  completers so the step is a true subset of `completed`; a cohort-wide
     *  submission count would not be. NOT time-ordered relative to
     *  completion — the underlying query is a distinct `userId` over ALL of
     *  a completer's submissions, with no `createdAt` comparison against
     *  `onboardingCompletedAt`. A user who submitted before ever finishing
     *  onboarding (e.g. signed in from a problem-page `callbackUrl`) is
     *  counted here too. */
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
            // Not "Submitted after finishing" — the query behind this count
            // is not time-ordered against completion (see the doc comment
            // on `submittedAfterCompleting`). A funnel step is already
            // understood as a subset of the step above it, so "Made a
            // submission" under "Finished onboarding" reads correctly
            // without asserting an ordering the data doesn't back up.
            label: "Made a submission",
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
