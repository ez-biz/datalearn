"use client"

import { useEffect } from "react"
import { List, PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { MobileSegments, type Segment } from "./MobileSegments"

interface WorkspaceLayoutProps {
    problemsPanel: React.ReactNode
    contextBar: React.ReactNode | null
    problemPanel: React.ReactNode
    editor: React.ReactNode
    panelOpen: boolean
    onTogglePanel: () => void
    /** Which of Problem/Code/Result is showing below `lg`. Ignored at `lg`
     *  and up, where problemPanel and editor (which internally splits into
     *  its own code/result blocks) are both always visible. */
    activeSegment: Segment
    onSegmentChange: (segment: Segment) => void
    /** Tints the mobile Result segment when a verdict hasn't been seen yet. */
    unseenVerdict: boolean
    /**
     * The all-problems list, built fresh (a second `<ProblemsPanel>`
     * instance, same component) for the mobile full-screen sheet. Kept
     * separate from `problemsPanel` — the desktop overlay/column instance —
     * because the two need different `onClose` wiring: the desktop instance
     * flips the persisted `panelOpen` preference, but a mobile learner
     * opening this sheet has no such preference to touch.
     */
    mobileProblemsPanel: React.ReactNode
    mobileProblemsOpen: boolean
    onToggleMobileProblems: () => void
}

/**
 * The workspace's column grid.
 *
 * At `xl` and above the problems panel is a real column. Between `lg` and
 * `xl` the editor would be squeezed too thin for four columns, so the panel
 * becomes an overlay drawer over the workspace instead — one instance,
 * switched by CSS, rather than two copies that would drift.
 *
 * Below `lg` the workspace becomes a segmented Problem/Code/Result view: a
 * header carries a list-icon trigger (opens the all-problems sheet) and the
 * segmented control, and exactly one of problemPanel/editor is visible at a
 * time, each filling the remaining height with its own scroll. All panes
 * stay mounted throughout — only `hidden` toggles, never conditional
 * rendering — so Monaco's model and the query result state in ProblemClient
 * both survive switching segments. (The editor's own code vs. result split
 * is handled inside EditorPane, driven by the same `activeSegment`.)
 *
 * The route is an app route (isAppRoute), so ConsoleChrome has already
 * dropped the footer and clamped #app-scroll at every width. That is what
 * lets these columns — and, below `lg`, exactly one segment at a time — own
 * their own scrolling.
 */
export function WorkspaceLayout({
    problemsPanel,
    contextBar,
    problemPanel,
    editor,
    panelOpen,
    onTogglePanel,
    activeSegment,
    onSegmentChange,
    unseenVerdict,
    mobileProblemsPanel,
    mobileProblemsOpen,
    onToggleMobileProblems,
}: WorkspaceLayoutProps) {
    useEffect(() => {
        if (!panelOpen) return
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onTogglePanel()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [panelOpen, onTogglePanel])

    useEffect(() => {
        if (!mobileProblemsOpen) return
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onToggleMobileProblems()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [mobileProblemsOpen, onToggleMobileProblems])

    return (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {panelOpen && (
                <>
                    {/* Scrim: only in the overlay band (lg → xl). */}
                    <div
                        onClick={onTogglePanel}
                        aria-hidden
                        className="fixed inset-0 z-30 hidden bg-background/60 lg:block xl:hidden"
                    />
                    <aside
                        aria-label="All problems"
                        className={cn(
                            "z-40 hidden w-[296px] shrink-0 flex-col border-r border-line-soft bg-panel lg:flex",
                            // Overlay below xl, in-flow column at xl and up.
                            "max-xl:fixed max-xl:inset-y-0 max-xl:left-0 max-xl:shadow-xl"
                        )}
                    >
                        {problemsPanel}
                    </aside>
                </>
            )}

            {!panelOpen && (
                /* Screen 10 puts the "All problems" reopen button in the lesson
                   context bar — but that bar only renders for problems linked
                   to a lesson checkpoint. A catalog problem has no bar, so the
                   button would have nowhere to live and closing the panel would
                   be a one-way door. It lives in the layout instead, which is
                   always present. */
                <button
                    type="button"
                    onClick={onTogglePanel}
                    aria-label="Open problems panel"
                    className="hidden w-8 shrink-0 items-start justify-center border-r border-line-soft bg-panel pt-3 text-text-3 transition-colors duration-150 hover:bg-panel-hover hover:text-text-2 lg:flex"
                >
                    <PanelLeftOpen className="h-4 w-4" aria-hidden />
                </button>
            )}

            <div className="flex min-h-0 flex-1 flex-col">
                {contextBar}

                {/* Mobile-only header: reach the catalog (list icon opens a
                    full-screen sheet — the panel above is `lg:flex` only, so
                    without this there is no way to reach another problem on
                    a phone) and the Problem/Code/Result switcher. */}
                <div className="flex shrink-0 items-center gap-2 border-b border-line-soft bg-panel px-3 py-2 lg:hidden">
                    <button
                        type="button"
                        onClick={onToggleMobileProblems}
                        aria-label="All problems"
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-3 transition-colors duration-150 hover:bg-panel-hover hover:text-text-2"
                    >
                        <List className="h-5 w-5" aria-hidden />
                    </button>
                    <MobileSegments
                        active={activeSegment}
                        onChange={onSegmentChange}
                        unseenVerdict={unseenVerdict}
                    />
                </div>

                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                    <aside
                        aria-label="Problem"
                        className={cn(
                            "min-h-0 w-full flex-col overflow-y-auto border-b border-line-soft",
                            activeSegment === "problem" ? "flex flex-1" : "hidden",
                            "lg:flex lg:w-[400px] lg:flex-none lg:border-b-0 lg:border-r"
                        )}
                    >
                        {problemPanel}
                    </aside>
                    {/* min-w-0 is load-bearing: a flex child defaults to
                        min-width:auto, so the editor's content (Monaco, the
                        action bar) would push this column past the viewport
                        and clip Run/Submit rather than shrinking.

                        Below `lg` this section is hidden outright on the
                        "problem" segment — its content (EditorPane) stays
                        mounted regardless; only its own code/result blocks
                        toggle when the segment is "code" or "result". */}
                    <section
                        className={cn(
                            "min-h-0 min-w-0 flex-col bg-background",
                            activeSegment === "problem" ? "hidden" : "flex flex-1",
                            "lg:flex lg:flex-1"
                        )}
                    >
                        {editor}
                    </section>
                </div>
            </div>

            {mobileProblemsOpen && (
                // ProblemsPanel already renders its own "Close problems
                // panel" button, wired to onClose (here, onToggleMobileProblems)
                // by whoever builds `mobileProblemsPanel` — this backdrop is
                // a mouse/touch-only dismiss target (matching the desktop
                // scrim above: a plain aria-hidden div, not a second control
                // fighting the panel's own button for the same name).
                // Escape is handled by the effect above.
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div
                        onClick={onToggleMobileProblems}
                        aria-hidden
                        className="absolute inset-0 bg-canvas-deep/70"
                    />
                    {/* role="region" rather than "dialog"/aria-modal, matching
                        ContentsSheet's sheet — this doesn't implement a focus
                        trap, so it shouldn't claim modal semantics it can't
                        back up. Escape and the backdrop both dismiss it. */}
                    <div
                        role="region"
                        aria-label="All problems"
                        className="absolute inset-0 flex flex-col bg-panel"
                    >
                        {mobileProblemsPanel}
                    </div>
                </div>
            )}
        </div>
    )
}
