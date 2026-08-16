"use client"

import { PanelLeft } from "lucide-react"

interface ConsoleAdminSidebarFrameProps {
    /**
     * Account menu trigger (UserMenu) or the sign-in button — the same slot
     * ConsoleSidebar renders in its header row, so an admin can sign out (or
     * switch theme, via ThemeRow further down in the server-rendered
     * content) without leaving /admin/*.
     */
    headerSlot: React.ReactNode
    onToggle: () => void
    /**
     * The server-rendered ConsoleAdminSidebar content (identity row + nav +
     * footer), passed as children rather than composed inside
     * ConsoleAdminSidebar itself: the collapse toggle needs
     * useSidebarCollapse's `toggle` closure, which only exists once
     * ConsoleChrome has mounted client-side — long after ConsoleAdminSidebar
     * was already built server-side in ConsoleShell. This thin client
     * wrapper is where that closure is actually in scope.
     */
    children: React.ReactNode
}

/**
 * Wraps the server-rendered admin nav with the header row ConsoleSidebar
 * carries and ConsoleAdminSidebar cannot own itself: headerSlot on the left,
 * the collapse toggle on the right, in the same placement and markup as
 * ConsoleSidebar so the two read consistently.
 */
export function ConsoleAdminSidebarFrame({ headerSlot, onToggle, children }: ConsoleAdminSidebarFrameProps) {
    return (
        <div className="hidden w-[236px] shrink-0 flex-col border-r border-line-soft bg-panel lg:flex">
            <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                <div className="min-w-0 flex-1">{headerSlot}</div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                    className="text-text-dim transition-colors duration-150 hover:text-foreground"
                >
                    <PanelLeft className="h-[15px] w-[15px]" aria-hidden />
                </button>
            </div>
            {children}
        </div>
    )
}
