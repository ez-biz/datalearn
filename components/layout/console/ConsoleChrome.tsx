"use client"

import { ConsoleRail } from "./ConsoleRail"
import { ConsoleSidebar, type TrackProgress } from "./ConsoleSidebar"
import { MobileTabBar } from "./MobileTabBar"
import { useSidebarCollapse } from "./useSidebarCollapse"
import type { SidebarState } from "./sidebar-cookie"

interface ConsoleChromeProps {
    initialState: SidebarState
    signedIn: boolean
    trackProgress: TrackProgress | null
    pageLinks: Array<{ slug: string; title: string }>
    headerSlot: React.ReactNode
    /** Account menu trigger for the collapsed rail. Null when signed out. */
    railAccountSlot: React.ReactNode | null
    /** Account menu trigger for the mobile "You" tab. */
    tabBarAccountSlot: React.ReactNode
    signInSlot: React.ReactNode
    children: React.ReactNode
}

export function ConsoleChrome({
    initialState,
    signedIn,
    trackProgress,
    pageLinks,
    headerSlot,
    railAccountSlot,
    tabBarAccountSlot,
    signInSlot,
    children,
}: ConsoleChromeProps) {
    const { collapsed, toggle } = useSidebarCollapse(initialState)

    return (
        <div className="flex h-dvh overflow-hidden">
            {collapsed ? (
                <ConsoleRail onToggle={toggle} accountSlot={railAccountSlot} />
            ) : (
                <ConsoleSidebar
                    trackProgress={trackProgress}
                    pageLinks={pageLinks}
                    onToggle={toggle}
                    headerSlot={headerSlot}
                />
            )}
            {children}
            <MobileTabBar signedIn={signedIn} accountSlot={tabBarAccountSlot} signInSlot={signInSlot} />
        </div>
    )
}
