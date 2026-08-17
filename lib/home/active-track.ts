// Picks which track the signed-in home dashboard features. Pure — no
// Prisma, no React, no DOM — so it unit-tests without a database, the same
// way lib/home/weak-spots.ts and lib/home/today-plan.ts do for their cards.
//
// Deliberately typed against a minimal structural shape rather than
// importing TrackSummary from lib/learn/tracks-read.ts: that module reaches
// into Prisma, and this one must not, even indirectly through a type-only
// import. lib/home/home-read.ts calls this with the real TrackSummary[] —
// the generic below preserves that concrete type through the return value
// instead of widening it to the minimal shape.

export type ActiveTrackCandidate = {
    rollup: { percent: number }
    /** Most recent lesson completion or accepted submission *within this
     *  track*, or null when the viewer has never touched it. See
     *  lib/learn/tracks-read.ts's TrackSummary.lastActivityAt for how this
     *  is computed. */
    lastActivityAt: Date | null
}

/**
 * The track to feature on the dashboard.
 *
 * Rules, in order:
 *
 *  1. A track with work left (`rollup.percent < 100`) is preferred over a
 *     finished one, regardless of either track's percent or recency. A
 *     100%-complete track has nothing left to resume, so featuring it
 *     degrades ResumeCard to a practice-problem fallback for no visible
 *     reason while an in-progress track sits unfeatured.
 *  2. Among the resulting candidates (every unfinished track, or — if every
 *     track is finished — every track), the most recently active one wins:
 *     the max of `lastActivityAt`. This is "active," not "furthest along" —
 *     a learner grinding daily on a 20%-complete track should see that
 *     track, not a different one they happened to front-load progress on
 *     weeks ago and haven't opened since.
 *  3. Ties in `lastActivityAt` keep the earlier candidate in array order
 *     (getTrackSummariesForUser orders newest-created first, then name),
 *     matching this function's previous tie-break behavior.
 *  4. If none of the candidates has ever been touched (`lastActivityAt` is
 *     null for all of them), there is no activity signal to rank by — this
 *     falls back to the first candidate in array order. That fallback is
 *     deliberate, not incidental: any consistent choice is equally
 *     "correct" with zero signal, and picking the first keeps the featured
 *     track stable across renders/requests instead of depending on
 *     iteration order or ties in unrelated fields.
 *
 * Returns null only when `tracks` itself is empty. When every track is
 * finished, this still returns the most recently active one rather than
 * null — ResumeCard and ModuleProgress both already degrade honestly for a
 * finished track, which is a better dashboard for a learner who completed
 * everything than a blank one.
 */
export function pickActiveTrack<T extends ActiveTrackCandidate>(
    tracks: T[]
): T | null {
    if (tracks.length === 0) return null

    const unfinished = tracks.filter((t) => t.rollup.percent < 100)
    const candidates = unfinished.length > 0 ? unfinished : tracks

    const touched = candidates.filter(
        (t): t is T & { lastActivityAt: Date } => t.lastActivityAt !== null
    )
    if (touched.length === 0) return candidates[0]

    return touched.reduce((best, t) =>
        t.lastActivityAt > best.lastActivityAt ? t : best
    )
}
