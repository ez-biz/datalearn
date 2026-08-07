"use client"

import { ConsoleRail } from "./ConsoleRail"
import { ConsoleSidebar, type TrackProgress } from "./ConsoleSidebar"
import { MobileTabBar } from "./MobileTabBar"
import { useSidebarCollapse } from "./useSidebarCollapse"
import type { SidebarState } from "./sidebar-cookie"

interface ConsoleChromeProps {
    initialState: SidebarState
    initials: string | null
    signedIn: boolean
    trackProgress: TrackProgress | null
    pageLinks: Array<{ slug: string; title: string }>
    headerSlot: React.ReactNode
    signInSlot: React.ReactNode
    children: React.ReactNode
}

export function ConsoleChrome({
    initialState,
    initials,
    signedIn,
    trackProgress,
    pageLinks,
    headerSlot,
    signInSlot,
    children,
}: ConsoleChromeProps) {
    const { collapsed, toggle } = useSidebarCollapse(initialState)

    return (
        <div className="flex h-dvh overflow-hidden">
            {collapsed ? (
                <ConsoleRail onToggle={toggle} initials={initials} />
            ) : (
                <ConsoleSidebar
                    trackProgress={trackProgress}
                    pageLinks={pageLinks}
                    onToggle={toggle}
                    headerSlot={headerSlot}
                />
            )}
            {children}
            <MobileTabBar signedIn={signedIn} signInSlot={signInSlot} />
        </div>
    )
}
