const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/

export type DailyProblemCandidate = {
    id: string
    number: number
    lastDailyAt: Date | null
}

export function normalizeDailyDate(date: Date = new Date()): Date {
    return new Date(
        Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    )
}

export function parseDailyDateKey(key: string): Date {
    if (!DAY_KEY_RE.test(key)) {
        throw new Error("Daily date must use YYYY-MM-DD format.")
    }
    const [year, month, day] = key.split("-").map(Number)
    const parsed = normalizeDailyDate(new Date(Date.UTC(year, month - 1, day)))
    if (
        parsed.getUTCFullYear() !== year ||
        parsed.getUTCMonth() !== month - 1 ||
        parsed.getUTCDate() !== day
    ) {
        throw new Error("Daily date must be a valid calendar date.")
    }
    return parsed
}

export function toDailyKey(date: Date): string {
    const normalized = normalizeDailyDate(date)
    const year = normalized.getUTCFullYear()
    const month = String(normalized.getUTCMonth() + 1).padStart(2, "0")
    const day = String(normalized.getUTCDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export function addUtcDays(date: Date, days: number): Date {
    const normalized = normalizeDailyDate(date)
    normalized.setUTCDate(normalized.getUTCDate() + days)
    return normalized
}

export function selectAutoDailyCandidate<T extends DailyProblemCandidate>(
    candidates: T[]
): T | null {
    if (candidates.length === 0) return null
    return [...candidates].sort((a, b) => {
        if (a.lastDailyAt === null && b.lastDailyAt !== null) return -1
        if (a.lastDailyAt !== null && b.lastDailyAt === null) return 1
        if (a.lastDailyAt !== null && b.lastDailyAt !== null) {
            const diff = a.lastDailyAt.getTime() - b.lastDailyAt.getTime()
            if (diff !== 0) return diff
        }
        return a.number - b.number
    })[0]
}
