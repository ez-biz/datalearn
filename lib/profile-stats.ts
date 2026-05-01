/**
 * Pure helpers for the /profile redesign. Server-side only is fine, but
 * these have no Prisma/Next dependencies — they're easy to unit test and
 * can be reused anywhere.
 */

export type DayBucket = { date: string; count: number }
export type StreakInfo = {
    current: number
    longest: number
    lastActiveDate: string | null
}

/**
 * Convert a Date to a stable YYYY-MM-DD key in UTC. The heatmap and
 * streak logic both rely on day-bucketing; doing it in UTC avoids
 * timezone wobble when the same submission could otherwise land on
 * different days for users in different zones.
 */
export function toDayKey(d: Date): string {
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, "0")
    const day = String(d.getUTCDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
}

/**
 * Build a 365-day heatmap series ending today (UTC). Days with no
 * submissions render as count=0. The output is always exactly
 * `windowDays` entries long, oldest first — convenient for laying out
 * the grid week-by-week.
 */
export function buildHeatmap(
    submissionDates: Date[],
    windowDays = 365,
    today: Date = new Date()
): DayBucket[] {
    const counts = new Map<string, number>()
    for (const d of submissionDates) {
        const key = toDayKey(d)
        counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    // Anchor "today" to UTC midnight so the loop produces stable keys.
    const todayMidnight = new Date(
        Date.UTC(
            today.getUTCFullYear(),
            today.getUTCMonth(),
            today.getUTCDate()
        )
    )
    const out: DayBucket[] = []
    for (let i = windowDays - 1; i >= 0; i--) {
        const cur = new Date(todayMidnight)
        cur.setUTCDate(cur.getUTCDate() - i)
        const key = toDayKey(cur)
        out.push({ date: key, count: counts.get(key) ?? 0 })
    }
    return out
}

/**
 * Compute current and longest streak from a heatmap series.
 *
 * Current streak = length of the trailing run of days with ≥1 submission,
 * counting back from today; if today is empty, we extend the grace by one
 * day (yesterday counts) so users don't lose a streak by being timezone-
 * adjacent to the date boundary at the moment they load the page.
 *
 * Longest streak = max consecutive run of non-zero days anywhere in the
 * series.
 */
export function computeStreaks(heatmap: DayBucket[]): StreakInfo {
    let longest = 0
    let run = 0
    let lastActive: string | null = null
    for (const d of heatmap) {
        if (d.count > 0) {
            run += 1
            if (run > longest) longest = run
            lastActive = d.date
        } else {
            run = 0
        }
    }
    // Current streak: walk backwards from the last entry (today). If today
    // is empty but yesterday isn't, the streak is yesterday's-trailing-run.
    let current = 0
    let i = heatmap.length - 1
    if (i >= 0 && heatmap[i].count === 0) {
        // skip today's empty entry — grace
        i -= 1
    }
    for (; i >= 0; i--) {
        if (heatmap[i].count > 0) current += 1
        else break
    }
    return { current, longest, lastActiveDate: lastActive }
}
