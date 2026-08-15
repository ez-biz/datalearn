"use client"

import { usePathname } from "next/navigation"
import { ConsoleRail } from "./ConsoleRail"
import { ConsoleSidebar, type TrackProgress } from "./ConsoleSidebar"
import { isAppRoute, isFocusRoute } from "./focus-route"
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
    /**
     * The site <Footer />, passed in rather than imported.
     *
     * Footer is an async server component; a client module that imported it
     * would drag it across the boundary and React would reject it ("async/await
     * is not yet supported in Client Components"). ConsoleShell — a server
     * component — renders the element and hands it down, exactly like
     * headerSlot / railAccountSlot / tabBarAccountSlot / signInSlot.
     */
    footerSlot: React.ReactNode
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
    footerSlot,
    children,
}: ConsoleChromeProps) {
    const { collapsed, toggle } = useSidebarCollapse(initialState)
    const pathname = usePathname()
    const focus = isFocusRoute(pathname)
    const app = isAppRoute(pathname)

    return (
        <div className="flex h-dvh overflow-hidden print:block print:h-auto print:overflow-visible">
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
                the full viewport.

                On focus routes the shell is suppressed entirely and the page
                supplies its own <header> and <main>. That header is a child of
                #app-scroll — a plain <div> — so it still maps to `banner`, and
                there is still exactly one per viewport.

                This is why #app-scroll and <main> live here rather than in
                app/layout.tsx: a nested layout is always inside root layout's
                <main>, and ARIA forbids `banner` inside `main`. */}
            {!focus && (
                <header className="flex shrink-0 print:hidden">
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
            )}
            {/* #app-scroll (not #main-content) is what MainScrollRestoration,
                SignInDialog and ReportDialog reach for — they want the element
                that owns the scrollbar. #main-content stays on <main> so the
                skip link still lands on the content itself.

                <Footer> is a sibling of <main>, not a child: a <footer> only
                maps to `contentinfo` when it is NOT inside
                article/aside/main/nav/section, and ARIA forbids nesting
                `contentinfo` in `main`, which rules out patching it with an
                explicit role. Keeping it inside the scroll container means it
                still scrolls away with the page.

                pb-14 clears the 56px fixed MobileTabBar; focus routes render no
                tab bar, so they must not carry it. App routes retain that
                mobile clearance at every width, but clamp this outer
                container's scroll at every width too — the workspace panes
                own their scrolling below `lg` as well as above it, once the
                segmented mobile panes land. Their footer is omitted at every
                width: inside a clamped application view it would be
                unreachable, not merely out of the way. */}
            <div
                id="app-scroll"
                className={
                    focus
                        ? "flex flex-1 flex-col overflow-y-auto print:overflow-visible"
                        : app
                          ? "flex flex-1 flex-col overflow-hidden pb-14 lg:pb-0 print:overflow-visible print:pb-0"
                          : "flex flex-1 flex-col overflow-y-auto pb-14 lg:pb-0 print:overflow-visible print:pb-0"
                }
            >
                {focus ? (
                    children
                ) : (
                    <>
                        <main
                            id="main-content"
                            tabIndex={-1}
                            className={
                                app
                                    ? "flex min-h-0 flex-1 flex-col focus:outline-none"
                                    : "flex flex-1 flex-col focus:outline-none"
                            }
                        >
                            {children}
                        </main>
                        {!app && footerSlot}
                    </>
                )}
            </div>
            <MainScrollRestoration />
        </div>
    )
}
