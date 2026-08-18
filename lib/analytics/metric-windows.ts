import { buildHeatmap, type DayBucket } from "../profile-stats"

export const MAX_WINDOW_DAYS = 365

export interface WindowBounds {
    start: Date
    end: Date
}

export function assertWindow(windowDays: number): void {
    if (
        !Number.isInteger(windowDays) ||
        windowDays <= 0 ||
        windowDays > MAX_WINDOW_DAYS
    ) {
        throw new RangeError(
            `windowDays must be an integer between 1 and ${MAX_WINDOW_DAYS}`
        )
    }
}

function utcMidnight(date: Date): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
}

export function windowBounds(windowDays: number, endDay: Date): WindowBounds {
    assertWindow(windowDays)

    const end = utcMidnight(endDay)
    end.setUTCDate(end.getUTCDate() + 1)

    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - windowDays)

    return { start, end }
}

export function previousWindowBounds(
    windowDays: number,
    endDay: Date
): WindowBounds {
    const current = windowBounds(windowDays, endDay)
    const end = new Date(current.start)
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - windowDays)

    return { start, end }
}

export function dailySeries(
    dates: Date[],
    windowDays: number,
    endDay: Date
): DayBucket[] {
    assertWindow(windowDays)
    return buildHeatmap(dates, windowDays, endDay)
}
