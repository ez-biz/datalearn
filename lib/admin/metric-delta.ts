// Pure delta computation for admin dashboard metric cards.
//
// Contract: `previous: null` means "this metric has no historical basis" —
// e.g. no model in the schema carries `publishedAt`, so a published-count
// delta cannot be computed, and queue depths (open reports, pending review)
// have no meaningful "growth". In those cases the caller must render no
// delta line at all, not a zero and not a dash.
//
// `previous: 0` is different: it is real data (genuine growth from
// nothing) and must produce a delta. Do not treat `0` and `null` alike —
// that would either fabricate a number or hide a real one.
//
// No Prisma, no React, no next/*, no DOM — keep this importable from a
// plain `node --import tsx --test` run with no database.

export type DeltaDirection = "up" | "down" | "flat"

export interface MetricDelta {
    /** Signed change against the previous period. */
    change: number
    direction: DeltaDirection
}

/** Returns null when a delta would be dishonest — the caller renders no
 *  delta line at all in that case, not a zero and not a dash. */
export function computeDelta(
    current: number,
    previous: number | null
): MetricDelta | null {
    if (previous === null) {
        return null
    }

    const change = current - previous
    const direction: DeltaDirection =
        change > 0 ? "up" : change < 0 ? "down" : "flat"

    return { change, direction }
}
