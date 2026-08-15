// Server component: renders the admin sidebar that ConsoleChrome swaps in
// for the learner ConsoleSidebar on /admin/* routes (see ConsoleChrome.tsx).
// Deliberately NOT "use client" — the full ADMIN_NAV item list (icons,
// hrefs, badge keys) must never ship to the browser bundle for the general
// population of visitors, only for the small set of signed-in ADMIN /
// MODERATOR users this ever renders for. The one piece that genuinely needs
// the live pathname (active-item highlighting) is isolated in the small
// client leaf AdminSidebarLink.
import Link from "next/link"
import { ShieldCheck } from "lucide-react"
import {
    visibleAdminNav,
    type AdminBadgeKey,
    type AdminNavViewer,
} from "@/lib/admin/admin-nav-model"
import { AdminSidebarLink } from "./AdminSidebarLink"

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
        <div className="hidden w-[236px] shrink-0 flex-col border-r border-line-soft bg-panel lg:flex">
            <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
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
                                    itemKey={item.key}
                                    href={item.href}
                                    label={item.label}
                                    icon={<item.icon className="h-[15px] w-[15px]" aria-hidden />}
                                    badgeCount={badgeFor(item.badgeKey, badges)}
                                />
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="mt-auto border-t border-line-soft p-2">
                    <Link
                        href="/"
                        className="flex items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-[13.5px] text-text-muted transition-colors duration-150 hover:bg-panel-hover hover:text-foreground"
                    >
                        Back to the site
                    </Link>
                </div>
            </div>
        </div>
    )
}
