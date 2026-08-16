// Server component: renders the admin sidebar content that
// ConsoleAdminSidebarFrame wraps for /admin/* routes (see ConsoleChrome.tsx).
// Deliberately NOT "use client" — the full ADMIN_NAV item list (icons,
// hrefs, badge keys) must never ship to the browser bundle for the general
// population of visitors, only for the small set of signed-in ADMIN /
// MODERATOR users this ever renders for. The one piece that genuinely needs
// the live pathname (active-item highlighting) is isolated in the small
// client leaf AdminSidebarLink.
//
// Returns a fragment, not its own sized container: the headerSlot
// (UserMenu, sign-out) + collapse toggle row lives in
// ConsoleAdminSidebarFrame instead, because that row needs
// useSidebarCollapse's `toggle` closure, which only exists once
// ConsoleChrome has mounted client-side — long after this component was
// already built server-side in ConsoleShell. ThemeRow, by contrast, needs no
// such closure (useHydratedTheme is self-contained), so it's rendered
// directly here, same as AdminSidebarLink.
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import {
    visibleAdminNav,
    type AdminBadgeKey,
    type AdminNavViewer,
} from "@/lib/admin/admin-nav-model"
import { AdminSidebarLink } from "./AdminSidebarLink"
import { ThemeRow } from "./ThemeToggle"

export interface AdminBadgeCounts {
    openReports: number
    articleQueue: number
    discussionQueue: number
}

interface ConsoleAdminSidebarProps {
    viewer: AdminNavViewer
    badges: AdminBadgeCounts
}

function badgeFor(key: AdminBadgeKey | undefined, badges: AdminBadgeCounts): number | undefined {
    if (!key) return undefined
    return badges[key]
}

export function ConsoleAdminSidebar({ viewer, badges }: ConsoleAdminSidebarProps) {
    const groups = visibleAdminNav(viewer)

    return (
        <>
            <div className="flex items-center gap-2.5 px-3 pb-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] bg-accent/15 text-accent">
                    <ShieldCheck className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
                    Admin
                </div>
                <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-accent">
                    {viewer.role === "ADMIN" ? "Owner" : "Moderator"}
                </span>
            </div>

            {/* Same min-h-0 + overflow-y-auto shape as ConsoleSidebar: lets
                this region shrink below its content height so the group list
                scrolls instead of overflowing the h-dvh shell. */}
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                <nav aria-label="Admin" className="flex flex-col gap-3 px-2 py-1.5">
                    {groups.map((group) => (
                        <div key={group.label ?? "__root"} className="flex flex-col gap-px">
                            {group.label && (
                                <div className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                                    {group.label}
                                </div>
                            )}
                            {group.items.map((item) => (
                                <AdminSidebarLink
                                    key={item.key}
                                    href={item.href}
                                    match={item.match ?? "prefix"}
                                    label={item.label}
                                    icon={<item.icon className="h-[15px] w-[15px]" aria-hidden />}
                                    badgeCount={badgeFor(item.badgeKey, badges)}
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="mt-auto flex flex-col gap-px border-t border-line-soft p-2">
                    <ThemeRow />
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-[13.5px] text-text-muted transition-colors duration-150 hover:bg-panel-hover hover:text-foreground"
                    >
                        Back to the site
                    </Link>
                </div>
            </div>
        </>
    )
}
