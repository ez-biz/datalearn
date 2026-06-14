// Pure helpers for the contest play UI. No Prisma client, no React — only the
// ContestVerdict type. See docs/superpowers/specs/2026-06-14-contest-play-design.md.
import type { ContestVerdict } from "@prisma/client"

export type PlayMode =
    | "SIGNED_OUT"
    | "NOT_STARTED"
    | "ENDED"
    | "NOT_REGISTERED"
    | "PLAY"

/**
 * Decide what the play page should render. Status gates (NOT_STARTED / ENDED)
 * apply to everyone; sign-in and registration only matter while LIVE.
 */
export function gatingFromStatus(
    status: "SCHEDULED" | "LIVE" | "CLOSED",
    signedIn: boolean,
    registered: boolean
): PlayMode {
    if (status === "SCHEDULED") return "NOT_STARTED"
    if (status === "CLOSED") return "ENDED"
    if (!signedIn) return "SIGNED_OUT"
    return registered ? "PLAY" : "NOT_REGISTERED"
}

export type VerdictTone = "success" | "error" | "neutral"

/** Verdict-only label (no hidden-data leak). ACCEPTED carries the points won. */
export function verdictLabel(
    verdict: ContestVerdict,
    points: number
): { text: string; tone: VerdictTone } {
    switch (verdict) {
        case "ACCEPTED":
            return { text: `Accepted (+${points} pts)`, tone: "success" }
        case "WRONG_ANSWER":
            return { text: "Wrong Answer", tone: "error" }
        case "TIME_LIMIT":
            return { text: "Time Limit Exceeded", tone: "error" }
        case "MEMORY_LIMIT":
            return { text: "Memory Limit Exceeded", tone: "error" }
        case "RUNTIME_ERROR":
            return { text: "Runtime Error", tone: "error" }
        case "COMPILE_ERROR":
            return { text: "Compile Error", tone: "error" }
        case "REJECTED":
            return { text: "Rejected", tone: "error" }
        case "INTERNAL_ERROR":
            return { text: "Internal Error", tone: "neutral" }
    }
}

/** Format remaining milliseconds as H:MM:SS, clamped at zero. */
export function formatRemaining(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(total / 3600)
    const minutes = Math.floor((total % 3600) / 60)
    const seconds = total % 60
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
}
