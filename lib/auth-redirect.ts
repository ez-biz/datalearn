export type AuthProvider = "google" | "github"

const DEFAULT_CALLBACK_PATH = "/"
const CALLBACK_BASE_URL = "https://datalearn.local"

function hasAsciiControlCharacter(value: string): boolean {
    for (let index = 0; index < value.length; index += 1) {
        const code = value.charCodeAt(index)
        if (code <= 0x1f || code === 0x7f) return true
    }

    return false
}

export function sanitizeAuthCallbackPath(value: string | string[] | undefined | null): string {
    const raw = Array.isArray(value) ? value[0] : value
    if (!raw) return DEFAULT_CALLBACK_PATH

    let decoded: string
    try {
        decoded = decodeURIComponent(raw)
    } catch {
        return DEFAULT_CALLBACK_PATH
    }

    if (!decoded.startsWith("/") || decoded.startsWith("//")) {
        return DEFAULT_CALLBACK_PATH
    }

    if (decoded.includes("\\") || hasAsciiControlCharacter(decoded)) {
        return DEFAULT_CALLBACK_PATH
    }

    try {
        const url = new URL(decoded, CALLBACK_BASE_URL)
        if (url.origin !== CALLBACK_BASE_URL) return DEFAULT_CALLBACK_PATH

        return `${url.pathname}${url.search}${url.hash}`
    } catch {
        return DEFAULT_CALLBACK_PATH
    }
}

export function signInPath(callbackUrl?: string | null): string {
    const safeCallback = sanitizeAuthCallbackPath(callbackUrl)
    if (safeCallback === DEFAULT_CALLBACK_PATH) return "/auth/signin"
    return `/auth/signin?callbackUrl=${encodeURIComponent(safeCallback)}`
}
