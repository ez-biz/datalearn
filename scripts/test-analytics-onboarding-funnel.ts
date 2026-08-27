// Unit tests for the pure onboarding funnel assembly. No database.
//
// Run: node --import tsx --test scripts/test-analytics-onboarding-funnel.ts

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import {
    buildOnboardingFunnel,
    skipRate,
    type OnboardingCounts,
} from "../lib/analytics/onboarding-funnel"

function counts(over: Partial<OnboardingCounts> = {}): OnboardingCounts {
    return {
        signedUp: 0,
        reached: 0,
        answered: 0,
        completed: 0,
        submittedAfterCompleting: 0,
        skipped: 0,
        ...over,
    }
}

describe("buildOnboardingFunnel", () => {
    it("reports four steps in order", () => {
        const steps = buildOnboardingFunnel(
            counts({ signedUp: 100, reached: 80, completed: 55, submittedAfterCompleting: 30 }),
        )
        assert.deepEqual(
            steps.map((s) => s.key),
            ["signedUp", "reached", "completed", "submitted"],
        )
    })

    it("computes rates against the previous step and the start", () => {
        const steps = buildOnboardingFunnel(
            counts({ signedUp: 100, reached: 80, completed: 55, submittedAfterCompleting: 30 }),
        )
        assert.equal(steps[1].rateFromPrevious, 0.8)
        assert.equal(steps[3].rateFromStart, 0.3)
    })

    it("reports null rates over an empty cohort, never zero", () => {
        // An empty cohort is unknown, not a 0% conversion. Rendering 0%
        // would claim a catastrophic result that the data does not support.
        const steps = buildOnboardingFunnel(counts())
        assert.equal(steps[0].rateFromPrevious, null)
        for (const step of steps.slice(1)) {
            assert.equal(step.rateFromPrevious, null)
            assert.equal(step.rateFromStart, null)
        }
    })

    it("never reports a rateFromPrevious above 1, even in a skip-heavy cohort", () => {
        // `answered` is deliberately excluded from the chain: onboarding can be
        // completed without answering the level question (a skip), so
        // `completed` is not a subset of `answered` and comparing them would
        // produce a rate over 100%. Here more users completed than answered,
        // which would break monotonicity if `answered` were still a step.
        const steps = buildOnboardingFunnel(
            counts({
                signedUp: 100,
                reached: 80,
                answered: 20,
                completed: 70,
                submittedAfterCompleting: 30,
                skipped: 50,
            }),
        )
        for (const step of steps) {
            if (step.rateFromPrevious !== null) {
                assert.ok(
                    step.rateFromPrevious <= 1,
                    `expected ${step.key}.rateFromPrevious <= 1, got ${step.rateFromPrevious}`,
                )
            }
        }
    })
})

describe("skipRate", () => {
    it("is skipped over completed", () => {
        assert.equal(skipRate(counts({ completed: 50, skipped: 10 })), 0.2)
    })

    it("is null when nobody has completed", () => {
        assert.equal(skipRate(counts({ completed: 0, skipped: 0 })), null)
    })

    it("is 1 when everyone skipped", () => {
        assert.equal(skipRate(counts({ completed: 8, skipped: 8 })), 1)
    })
})
