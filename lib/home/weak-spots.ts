// Weak-spots computation for the signed-in home dashboard. Pure — no React,
// no Prisma, no DOM — so it unit-tests without a database, the same way
// lib/workspace/problems-panel-model.ts does for the practice panel.
//
// The dashboard's "Weak spots" card shows the topics a learner is worst at,
// ranked so the most useful thing to drill lands first.

export type TaggedSubmission = {
    accepted: boolean
    /** Topic tag slugs on the problem this submission was for. */
    tags: Array<{ slug: string; name: string }>
}

export type WeakSpot = {
    slug: string
    name: string
    attempts: number
    accepted: number
    /** Whole percent, 0-100. */
    passRate: number
    /** Drives the bar colour. */
    band: "weak" | "mixed" | "strong"
}

/** Minimum attempts before a tag is judged at all. */
export const MIN_ATTEMPTS = 3

type Bucket = {
    slug: string
    name: string
    attempts: number
    accepted: number
}

function bandFor(passRate: number): WeakSpot["band"] {
    if (passRate < 50) return "weak"
    if (passRate < 80) return "mixed"
    return "strong"
}

/**
 * Whole-percent pass rate, clamped so the ends stay honest: a non-perfect
 * rate never rounds up to 100 and a non-zero rate never rounds down to 0.
 * Same approach as lib/workspace/pass-rate.ts's passRatePercent — attempts
 * here is always > 0 by the time this runs, since MIN_ATTEMPTS has already
 * filtered out empty buckets.
 */
function clampedPassRate(accepted: number, attempts: number): number {
    const raw = (accepted / attempts) * 100
    if (raw > 0 && raw < 1) return 1
    if (raw < 100 && raw > 99) return 99
    return Math.round(raw)
}

/**
 * Rank the tags a learner struggles with most.
 *
 * Rules, in order:
 *  1. Bucket submissions by tag slug — a submission with two tags counts
 *     once toward each, because it is evidence about both topics.
 *  2. Drop any tag with fewer than MIN_ATTEMPTS attempts; a single bad
 *     submission should not put a random topic at the top of the card.
 *  3. Pass rate is accepted/attempts, clamped at the ends (see
 *     clampedPassRate).
 *  4. Band by pass rate: weak under 50, mixed 50-79, strong 80 and up.
 *  5. Sort weakest first (ascending pass rate), ties broken by attempts
 *     descending — the tag struggled with more often is the more useful
 *     thing to drill — and then by slug for a stable order.
 *  6. Apply `limit` if given. The input array is never mutated.
 */
export function computeWeakSpots(
    submissions: TaggedSubmission[],
    limit?: number
): WeakSpot[] {
    const byTag = new Map<string, Bucket>()

    for (const submission of submissions) {
        for (const tag of submission.tags) {
            const bucket = byTag.get(tag.slug)
            if (bucket) {
                bucket.attempts += 1
                if (submission.accepted) bucket.accepted += 1
            } else {
                byTag.set(tag.slug, {
                    slug: tag.slug,
                    name: tag.name,
                    attempts: 1,
                    accepted: submission.accepted ? 1 : 0,
                })
            }
        }
    }

    const spots: WeakSpot[] = [...byTag.values()]
        .filter((bucket) => bucket.attempts >= MIN_ATTEMPTS)
        .map((bucket) => {
            const passRate = clampedPassRate(bucket.accepted, bucket.attempts)
            return {
                slug: bucket.slug,
                name: bucket.name,
                attempts: bucket.attempts,
                accepted: bucket.accepted,
                passRate,
                band: bandFor(passRate),
            }
        })

    spots.sort((a, b) => {
        if (a.passRate !== b.passRate) return a.passRate - b.passRate
        if (a.attempts !== b.attempts) return b.attempts - a.attempts
        return a.slug.localeCompare(b.slug)
    })

    return limit === undefined ? spots : spots.slice(0, limit)
}
