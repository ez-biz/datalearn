// Sidebar collapse state lives in a cookie rather than localStorage so the
// server can render the correct width on first paint. The root layout is
// already dynamic (it reads headers() for the CSP nonce), so the cookie read
// costs nothing extra.
//
// Pure string helpers — no React, no next/headers — so they are unit
// testable and usable from both server and client.

export const SIDEBAR_COOKIE = "dl:sidebar"

export type SidebarState = "expanded" | "collapsed"

/** Anything unrecognised means expanded. Never throws. */
export function parseSidebarState(raw: string | undefined): SidebarState {
    return raw === "collapsed" ? "collapsed" : "expanded"
}

/**
 * Deliberately NOT HttpOnly: the collapse toggle writes this from the client
 * via document.cookie, with no round trip.
 */
export function sidebarCookieString(state: SidebarState): string {
    return `${SIDEBAR_COOKIE}=${state}; Path=/; Max-Age=31536000; SameSite=Lax`
}
