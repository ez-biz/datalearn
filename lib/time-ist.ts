// Contest times standardize on IST (Asia/Kolkata, fixed +05:30). Pure + isomorphic.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

/** Interpret a `YYYY-MM-DDTHH:mm` datetime-local string as IST wall-clock → UTC Date. */
export function istLocalInputToUtc(localInput: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(localInput)
    if (!match) return new Date(NaN)
    const [y, mo, d, h, mi] = match.slice(1).map(Number)
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - IST_OFFSET_MS)
}

/** Format a UTC instant in IST, e.g. "Jun 18, 2026, 6:00 PM IST". */
export function formatIST(value: Date | string): string {
    const date = typeof value === "string" ? new Date(value) : value
    const formatted = date.toLocaleString("en-US", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    })
    return `${formatted} IST`
}
