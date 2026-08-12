// Pass-rate presentation. Pure — no React, no Prisma.
//
// The counters this reads are denormalized onto SQLProblem and maintained in
// the same transaction that writes a Submission, so reading them is O(1) per
// row. That matters: the problems panel renders the whole published catalog.
//
// Three honest limits, stated in the UI or the docs rather than hidden:
//   - validateSubmission refuses anonymous callers, so this measures
//     signed-in attempts only.
//   - It counts submissions, not people. One learner's ten tries move it ten
//     times.
//   - It drifts. Deleting a User cascades their Submissions away without
//     decrementing the counters, so a removed account leaves every problem it
//     attempted overcounted. scripts/verify-pass-rate-backfill.ts detects
//     that and --fix repairs it.

/**
 * Whole-percent pass rate, or null when there is nothing honest to show.
 *
 * Returns null for zero attempts (a problem nobody has tried is not a problem
 * nobody can solve) and for incoherent counters, which a bad backfill or a
 * half-applied migration could produce — better to render nothing than
 * "250% pass".
 */
export function passRatePercent(
    accepted: number,
    attempts: number
): number | null {
    if (!Number.isFinite(accepted) || !Number.isFinite(attempts)) return null
    if (attempts <= 0) return null
    if (accepted < 0 || accepted > attempts) return null

    const raw = (accepted / attempts) * 100
    // Clamp the ends inward: a near-miss must never read as a certainty, and
    // a rare success must never read as none at all.
    if (raw > 0 && raw < 1) return 1
    if (raw < 100 && raw > 99) return 99
    return Math.round(raw)
}

/** "67% pass", or null when there is nothing to show. */
export function formatPassRate(
    accepted: number,
    attempts: number
): string | null {
    const pct = passRatePercent(accepted, attempts)
    return pct === null ? null : `${pct}% pass`
}

/** Tooltip copy. States what the number counts, so it is not read per-person. */
export const PASS_RATE_TITLE =
    "Share of signed-in submissions that were accepted."
