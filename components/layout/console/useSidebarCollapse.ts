"use client"

import { useCallback, useState } from "react"
import { sidebarCookieString, type SidebarState } from "./sidebar-cookie"

/**
 * Collapse state, seeded from the server-rendered cookie value so there is no
 * width flash on first paint. The toggle updates local state optimistically
 * and writes the cookie directly — no server action, no round trip.
 */
export function useSidebarCollapse(initial: SidebarState) {
    const [state, setState] = useState<SidebarState>(initial)

    const toggle = useCallback(() => {
        setState((prev) => {
            const next: SidebarState = prev === "collapsed" ? "expanded" : "collapsed"
            document.cookie = sidebarCookieString(next)
            return next
        })
    }, [])

    return { collapsed: state === "collapsed", toggle }
}
