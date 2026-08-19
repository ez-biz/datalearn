/**
 * Map a delta direction to a visual tone, given what the metric means.
 *
 * `components/admin/MetricCard.tsx` hardcodes up -> text-easy (green) and
 * down -> text-destructive (red). That mapping is correct for sign-ups and
 * acceptance rate, and wrong for anything where rising is bad: a climbing
 * failure count or counter-drift count would render in the colour that
 * means "good". Analytics metrics therefore declare their polarity and the
 * tone is derived from it.
 *
 * No Prisma, no React, no next/*, no DOM — keep this importable from a
 * plain `node --import tsx --test` run with no database.
 */

import type { DeltaDirection } from "../admin/metric-delta"

/**
 * What a rising number means for this metric.
 * - `up-good`: more is better (sign-ups, problems solved)
 * - `up-bad`: more is worse (failures, drifted counters)
 * - `neutral`: direction carries no judgement (published problems)
 */
export type Polarity = "up-good" | "up-bad" | "neutral"

export type DeltaTone = "positive" | "negative" | "neutral"

export function deltaToneFor(
    direction: DeltaDirection,
    polarity: Polarity
): DeltaTone {
    // No movement is never good or bad, and a metric that declines to say
    // which way is "better" must not be coloured at all.
    if (direction === "flat" || polarity === "neutral") return "neutral"

    if (polarity === "up-good") {
        return direction === "up" ? "positive" : "negative"
    }
    return direction === "up" ? "negative" : "positive"
}
