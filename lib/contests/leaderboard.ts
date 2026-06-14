// Pure helpers for contest standings. No Prisma, no React — unit-testable
// without a DB. The persisted ContestLeaderboardEntry.rank is NOT maintained
// (always 0); rank is computed here from query order. See
// docs/superpowers/specs/2026-06-14-contest-standings-design.md.

export type LeaderboardRow = {
    rank: number
    userId: string
    participant: string
    solvedCount: number
    points: number
    penaltySeconds: number
}

export type RawLeaderboardEntry = {
    userId: string
    points: number
    penaltySeconds: number
    solvedCount: number
    user: { id: string; name: string | null }
}

/**
 * Map already-ordered leaderboard entries to display rows, assigning a 1-based
 * rank by position. Does NOT re-sort — ordering is owned by the DB query.
 */
export function toStandingsRows(
    entries: RawLeaderboardEntry[]
): LeaderboardRow[] {
    return entries.map((entry, index) => ({
        rank: index + 1,
        userId: entry.userId,
        participant: entry.user.name ?? "Anonymous",
        solvedCount: entry.solvedCount,
        points: entry.points,
        penaltySeconds: entry.penaltySeconds,
    }))
}

/** Format penalty seconds as H:MM:SS (hours unpadded, minutes/seconds 2-digit). */
export function formatPenalty(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const secs = total % 60
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${hours}:${pad(minutes)}:${pad(secs)}`
}
