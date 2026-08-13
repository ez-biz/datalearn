"use client"

import { useEffect } from "react"
import { PanelLeftOpen } from "lucide-react"
import { cn } from "@/lib/utils"

interface WorkspaceLayoutProps {
    problemsPanel: React.ReactNode
    contextBar: React.ReactNode | null
    problemPanel: React.ReactNode
    editor: React.ReactNode
    panelOpen: boolean
    onTogglePanel: () => void
}

/**
 * The workspace's column grid.
 *
 * At `xl` and above the problems panel is a real column. Between `lg` and
 * `xl` the editor would be squeezed too thin for four columns, so the panel
 * becomes an overlay drawer over the workspace instead — one instance,
 * switched by CSS, rather than two copies that would drift.
 *
 * Below `lg` the panel is not rendered at all and the workspace stacks and
 * scrolls with the page, exactly as it did before SP5. The mobile workspace
 * — segmented Problem/Code/Result — is SP6.
 *
 * The route is an app route (isAppRoute), so ConsoleChrome has already
 * dropped the footer and clamped #app-scroll at `lg`. That is what lets
 * these columns own their own scrolling.
 */
export function WorkspaceLayout({
    problemsPanel,
    contextBar,
    problemPanel,
    editor,
    panelOpen,
    onTogglePanel,
}: WorkspaceLayoutProps) {
    useEffect(() => {
        if (!panelOpen) return
        function onKey(event: KeyboardEvent) {
            if (event.key === "Escape") onTogglePanel()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [panelOpen, onTogglePanel])

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
                <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
                    <aside className="w-full shrink-0 border-b border-line-soft lg:min-h-0 lg:w-[400px] lg:overflow-y-auto lg:border-b-0 lg:border-r">
                        {problemPanel}
                    </aside>
                    {/* min-w-0 is load-bearing: a flex child defaults to
                        min-width:auto, so the editor's content (Monaco, the
                        action bar) would push this column past the viewport
                        and clip Run/Submit rather than shrinking. */}
                    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
                        {editor}
                    </section>
                </div>
            </div>
        </div>
    )
}
