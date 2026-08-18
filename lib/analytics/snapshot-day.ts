import { toDayKey } from "@/lib/profile-stats"

/** The UTC day assigned at the start of an authorized snapshot invocation. */
export function snapshotDayForRun(now: Date): string {
    return toDayKey(now)
}
