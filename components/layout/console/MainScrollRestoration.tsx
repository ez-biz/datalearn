"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Restores #main-content's scroll position on browser back/forward.
 *
 * The root layout's <body> is h-dvh overflow-hidden; <main id="main-content">
 * (see app/layout.tsx) is the real scroll container. Next.js's built-in
 * scroll restoration only ever tracks window.scrollY, which never moves
 * here, so back/forward would otherwise always land at the top of the
 * route instead of where the user left off — a regression introduced by
 * moving scroll ownership from <body> to <main> for the console shell.
 *
 * POP (back/forward) restores the last-known scrollTop recorded for that
 * pathname; PUSH (a fresh link click, including to a previously-visited
 * route) starts at the top, matching normal navigation UX.
 *
 * Position capture deliberately happens on a capture-phase document click
 * rather than a passive 'scroll' listener: when the outgoing route's
 * content unmounts, main's scrollHeight can momentarily shrink below its
 * current scrollTop, and the browser auto-clamps scrollTop to 0 — which
 * fires its own 'scroll' event. A passive listener still attached at that
 * instant (cleanup for the old pathname hasn't run yet) would record that
 * clamped 0 and clobber the real position. Reading scrollTop synchronously
 * during the click's capture phase — before React's bubble-phase onClick
 * triggers navigation and unmounts anything — sidesteps that race.
 */
const positions = new Map<string, number>()

export function MainScrollRestoration() {
    const pathname = usePathname()
    const pathnameRef = useRef(pathname)
    pathnameRef.current = pathname
    const isPop = useRef(false)

    useEffect(() => {
        const onPopState = () => {
            isPop.current = true
        }
        const onClickCapture = () => {
            const main = document.getElementById("main-content")
            if (main) positions.set(pathnameRef.current, main.scrollTop)
        }
        window.addEventListener("popstate", onPopState)
        document.addEventListener("click", onClickCapture, true)
        return () => {
            window.removeEventListener("popstate", onPopState)
            document.removeEventListener("click", onClickCapture, true)
        }
    }, [])

    useEffect(() => {
        const main = document.getElementById("main-content")
        if (!main) return
        main.scrollTop = isPop.current ? (positions.get(pathname) ?? 0) : 0
        isPop.current = false
    }, [pathname])

    return null
}
