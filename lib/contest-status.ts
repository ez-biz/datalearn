import type { ContestStatus } from "@prisma/client"

export type PublicContestStatus = "SCHEDULED" | "LIVE" | "CLOSED"

export function deriveContestStatus(
    startsAt: Date,
    endsAt: Date,
    dbStatus: ContestStatus | PublicContestStatus,
    now: Date = new Date()
): PublicContestStatus {
    if (
        dbStatus === "CANCELLED" ||
        dbStatus === "FINALIZED" ||
        dbStatus === "CLOSED"
    ) {
        return "CLOSED"
    }
    if (now < startsAt) return "SCHEDULED"
    if (now >= endsAt) return "CLOSED"
    return "LIVE"
}

/**
 * Standings exist only once a contest is running or finished. Written as a type
 * guard so a single check both gates the leaderboard fetch and narrows the
 * status for the `ContestStandings` component (which accepts only LIVE|CLOSED).
 */
export function hasStandings(
    status: PublicContestStatus
): status is "LIVE" | "CLOSED" {
    return status === "LIVE" || status === "CLOSED"
}
