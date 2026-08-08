"use client"

import { ConsoleRail } from "./ConsoleRail"
import { ConsoleSidebar, type TrackProgress } from "./ConsoleSidebar"
import { MainScrollRestoration } from "./MainScrollRestoration"
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
            {/* The shell chrome IS the site header, so it carries the `banner`
                landmark that the deleted <Navbar>'s <header> used to provide.
                A <header> maps to `banner` only when it is not inside
                article/aside/main/nav/section — this one is a direct child of
                a plain <div>, so it qualifies.

                Sidebar/rail AND the mobile tab bar live inside it deliberately:
                the sidebar and rail are `lg:`-only, so a <header> wrapping just
                those would evaluate to display:none below `lg` and the banner
                landmark would vanish on phones. Wrapping both means exactly one
                banner exists at every viewport — the sidebar (or rail) above
                `lg`, the tab bar below it.

                Layout-neutral: the element is a bare flex row with no size of
                its own. Above `lg` it takes the width of the sidebar/rail it
                wraps; below `lg` its only rendered child is the `fixed` tab
                bar, so it collapses to zero width and the scroll column keeps
                the full viewport. */}
            <header className="flex shrink-0">
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
                <MobileTabBar
                    signedIn={signedIn}
                    accountSlot={tabBarAccountSlot}
                    signInSlot={signInSlot}
                />
            </header>
            {children}
            <MainScrollRestoration />
        </div>
    )
}
