"use client"

import { PanelLeft } from "lucide-react"
import { ThemeIcon } from "./ThemeToggle"

interface ConsoleAdminRailFrameProps {
    onToggle: () => void
    /**
     * Account menu trigger (UserMenu with placement="rail"). Null when
     * signed out — same contract as ConsoleRail's accountSlot.
     */
    accountSlot: React.ReactNode | null
    /**
     * The server-rendered ConsoleAdminRail nav icons, passed as children
     * rather than composed inside ConsoleAdminRail itself: the expand
     * toggle needs useSidebarCollapse's `toggle` closure, which only exists
     * once ConsoleChrome has mounted client-side — long after
     * ConsoleAdminRail was already built server-side in ConsoleShell. This
     * thin client wrapper is where that closure is actually in scope.
     */
    children: React.ReactNode
}

/**
 * Collapsed counterpart to ConsoleAdminSidebarFrame — mirrors ConsoleRail's
 * shape (expand toggle, nav icons, theme + account at the bottom) so
 * collapsing the sidebar on an admin route never drops the sign-out/theme
 * affordances the learner rail already carries.
 */
export function ConsoleAdminRailFrame({ onToggle, accountSlot, children }: ConsoleAdminRailFrameProps) {
    return (
        <div className="hidden w-14 shrink-0 flex-col items-center gap-0.5 border-r border-line-soft bg-panel py-3 lg:flex">
            <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-dim transition-colors duration-150 hover:text-foreground"
            >
                <PanelLeft className="h-4 w-4" aria-hidden />
            </button>

            <span className="my-1.5 h-px w-6 bg-line-faint" />

            {children}

            <div className="mt-auto flex flex-col items-center gap-0.5">
                <ThemeIcon />
                {accountSlot && <div className="mt-1">{accountSlot}</div>}
            </div>
        </div>
    )
}
