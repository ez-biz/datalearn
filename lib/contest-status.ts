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
