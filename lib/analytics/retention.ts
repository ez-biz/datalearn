import { toDayKey } from "../profile-stats"

export const RETENTION_BUCKETS = [1, 7, 30] as const

export interface CohortRetention {
    cohortDay: string
    cohortSize: number
    retained: number | null
    /** Retained share from 0 through 1, or null when unknown; never percentage points. */
    rate: number | null
}

function dayAfter(cohortDay: string, days: number): string {
    const [year, month, day] = cohortDay.split("-").map(Number)
    const bucketDay = new Date(Date.UTC(year, month - 1, day))
    bucketDay.setUTCDate(bucketDay.getUTCDate() + days)
    return toDayKey(bucketDay)
}

export function cohortRetention(
    cohorts: Map<string, string[]>,
    activityByUser: Map<string, Set<string>>,
    bucketDays: number,
    today: Date
): CohortRetention[] {
    const todayKey = toDayKey(today)

    return [...cohorts.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([cohortDay, userIds]) => {
            const bucketDay = dayAfter(cohortDay, bucketDays)
            const cohortUserIds = new Set(userIds)
            const cohortSize = cohortUserIds.size

            if (bucketDay > todayKey) {
                return {
                    cohortDay,
                    cohortSize,
                    retained: null,
                    rate: null,
                }
            }

            const retained = [...cohortUserIds].filter((userId) =>
                [...(activityByUser.get(userId) ?? [])].some(
                    (activityDay) => activityDay >= bucketDay
                )
            ).length

            return {
                cohortDay,
                cohortSize,
                retained,
                rate: cohortSize === 0 ? null : retained / cohortSize,
            }
        })
}
