"use client"

import { usePathname } from "next/navigation"
import { useLayoutEffect, useRef } from "react"
import { isCrossRoutePop, resolveRestoreScrollTop } from "@/lib/scroll-restoration"

/**
 * Restores #app-scroll's scroll position on browser back/forward.
 *
 * The root layout's <body> is h-dvh overflow-hidden; <div id="app-scroll">
 * (see app/layout.tsx) is the real scroll container — it wraps <main> and
 * the <footer>, which has to sit outside <main> to keep its `contentinfo`
 * landmark. Next.js's built-in
 * scroll restoration only ever tracks window.scrollY, which never moves
 * here, so back/forward would otherwise always land at the top of the
 * route instead of where the user left off — a regression introduced by
 * moving scroll ownership from <body> to <main> for the console shell.
 *
 * POP (back/forward) restores the last-known scrollTop recorded for that
 * pathname; PUSH (a fresh link click, including to a previously-visited
 * route) starts at the top, matching normal navigation UX.
 *
 * Capture happens synchronously, at the moment a navigation is *initiated*,
 * from two event sources — a capture-phase document 'click' and a 'popstate'
 * listener — rather than from a useLayoutEffect cleanup keyed on [pathname].
 * That alternative reads as simpler (one effect, capture in its cleanup,
 * fires for every trigger) but reads main's scrollTop too late to be
 * correct: React runs an *updating* component's layout-effect cleanup in
 * the commit's layout phase, strictly after the commit's mutation phase —
 * i.e. after the outgoing route's DOM has already been replaced by the
 * incoming one. #app-scroll itself never unmounts (see app/layout.tsx;
 * only its routed children do), so its scrollTop survives, but by cleanup
 * time it already reflects the NEW page's (freshly-mounted, near-zero)
 * scrollTop, not the departing page's. Verified empirically: a scripted
 * scroll-then-navigate-then-back round trip landed back at 0 instead of the
 * scrolled position with that design.
 *
 * Capturing on 'click' (before React's bubble-phase onClick can trigger
 * navigation) and on 'popstate' (before Next's own popstate handler —
 * registered via a plain useEffect and wrapped in startTransition, see
 * next/dist/client/components/app-router.js — can commit the new route)
 * both read scrollTop before anything unmounts, so together they capture
 * every real navigation trigger: click, Back, Forward, and swipe-gesture
 * navigation (which also dispatches 'popstate'). A popstate fires for the
 * departure leg of BOTH Back and Forward, so a scroll-B / Back-to-A /
 * Forward-to-B round trip records and restores B's position on each leg,
 * not just the first — leaving via the Back button used to never be
 * captured at all, since the old design only ever captured on 'click'.
 *
 * isCrossRoutePop (lib/scroll-restoration.ts) guards against a second bug:
 * 'popstate' also fires for a same-pathname history entry (e.g. Back after
 * clicking a `#anchor` hash link). Treating that as a pop would arm isPop
 * with nothing to reset it — the [pathname] effect below never re-runs when
 * the pathname doesn't change — so the *next* ordinary push would be
 * misread as a pop and jump to a stale saved position. Only a popstate that
 * actually changes the pathname counts.
 *
 * The RESTORE side is a useLayoutEffect (not useEffect) so a POP never
 * paints an intermediate frame at scrollTop 0 before jumping to the saved
 * position.
 */
const positions = new Map<string, number>()

export function MainScrollRestoration() {
    const pathname = usePathname()
    const pathnameRef = useRef(pathname)
    pathnameRef.current = pathname
    const isPop = useRef(false)

    useLayoutEffect(() => {
        const capture = () => {
            const scroller = document.getElementById("app-scroll")
            if (scroller) positions.set(pathnameRef.current, scroller.scrollTop)
        }
        const onPopState = () => {
            capture()
            if (isCrossRoutePop(pathnameRef.current, window.location.pathname)) {
                isPop.current = true
            }
        }
        window.addEventListener("popstate", onPopState)
        document.addEventListener("click", capture, true)
        return () => {
            window.removeEventListener("popstate", onPopState)
            document.removeEventListener("click", capture, true)
        }
    }, [])

    useLayoutEffect(() => {
        const scroller = document.getElementById("app-scroll")
        if (scroller) {
            scroller.scrollTop = resolveRestoreScrollTop(isPop.current, positions.get(pathname))
        }
        isPop.current = false
    }, [pathname])

    return null
}
