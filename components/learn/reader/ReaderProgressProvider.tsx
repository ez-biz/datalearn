"use client"

import {
    createContext,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react"
import { recordLessonProgress } from "@/actions/curriculum"
import { scrollPercent, shouldPersist } from "@/lib/reading-progress"

const ReaderProgressContext = createContext<number>(0)

/** Live read percentage, 0-100. Monotonic within a page view. */
export function useReaderProgress(): number {
    return useContext(ReaderProgressContext)
}

interface ReaderProgressProviderProps {
    articleSlug: string
    /** Server-rendered starting point, so a returning reader resumes. */
    initialPercent: number
    /** Signed-out readers see the bar; nothing persists. */
    signedIn: boolean
    children: React.ReactNode
}

export function ReaderProgressProvider({
    articleSlug,
    initialPercent,
    signedIn,
    children,
}: ReaderProgressProviderProps) {
    const [percent, setPercent] = useState(initialPercent)
    // Refs, not state: these must not trigger re-renders, and the scroll
    // handler needs the latest value without being re-created.
    const maxRef = useRef(initialPercent)
    const writtenRef = useRef(initialPercent)
    const frameRef = useRef<number | null>(null)

    // `initialPercent` is a useState/useRef seed — React honours it on first
    // mount only and silently ignores it on every later render. On the
    // Prev/Next path between lessons, React may reconcile this provider in
    // place (same component, new props) rather than remounting it, so
    // `articleSlug` can change while `maxRef`/`writtenRef`/`percent` still
    // hold the PREVIOUS lesson's values. Left alone, the monotonic guard in
    // `measure()` (`if (next <= maxRef.current) return`) then reads as "this
    // lesson already reached lesson 1's progress" and silently blocks the
    // new lesson's real progress from ever registering or persisting until
    // it exceeds the leaked value — if lesson 1 hit 100, lesson 2 could
    // never complete at all. This render-phase reset (React's documented
    // "adjusting state when a prop changes" pattern) detects the slug
    // change during render and reseeds all three before paint, so a
    // reconciled-in-place provider behaves identically to a remounted one.
    // Deliberately keyed on `articleSlug` ALONE, not folded into the effect
    // below (whose deps also include `signedIn`) — a sign-in change
    // mid-lesson must not wipe the reader's in-progress percent.
    const slugRef = useRef(articleSlug)
    if (slugRef.current !== articleSlug) {
        slugRef.current = articleSlug
        maxRef.current = initialPercent
        writtenRef.current = initialPercent
        setPercent(initialPercent)
    }

    useEffect(() => {
        const scroller = document.getElementById("app-scroll")
        if (!scroller) return

        function persist(value: number) {
            if (!signedIn) return
            writtenRef.current = value
            // Fire-and-forget: a failed progress write must never surface to
            // a reader, and the next boundary retries anyway.
            void recordLessonProgress(articleSlug, value).catch(() => {})
        }

        function measure() {
            frameRef.current = null
            if (!scroller) return
            const next = scrollPercent(
                scroller.scrollTop,
                scroller.scrollHeight,
                scroller.clientHeight,
            )
            if (next <= maxRef.current) return
            maxRef.current = next
            setPercent(next)
            if (shouldPersist(writtenRef.current, next)) persist(next)
        }

        function onScroll() {
            if (frameRef.current !== null) return
            frameRef.current = requestAnimationFrame(measure)
        }

        function onHide() {
            if (document.visibilityState !== "hidden") return
            // Flush what the last boundary missed, so closing the tab
            // mid-lesson does not lose up to 10% of progress.
            if (maxRef.current > writtenRef.current) persist(maxRef.current)
        }

        // Measure once on mount. A lesson short enough not to scroll has no
        // scrollable distance, so scrollPercent returns 100 — but no scroll
        // event will ever fire, and without this call it could never
        // complete. Every seeded lesson is 4-5 minutes, so this is the
        // common path, not an edge case.
        measure()

        scroller.addEventListener("scroll", onScroll, { passive: true })
        document.addEventListener("visibilitychange", onHide)
        return () => {
            scroller.removeEventListener("scroll", onScroll)
            document.removeEventListener("visibilitychange", onHide)
            if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
        }
    }, [articleSlug, signedIn])

    return (
        <ReaderProgressContext.Provider value={percent}>
            {children}
        </ReaderProgressContext.Provider>
    )
}
