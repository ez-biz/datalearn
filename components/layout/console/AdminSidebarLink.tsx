"use client"

// The one interactive sliver of the admin sidebar. ConsoleAdminSidebar (the
// component that renders this) is a server component by design — see its
// file header — so it has no access to usePathname(). Active-item
// highlighting needs the live pathname, so that single concern is split into
// this tiny client leaf. Everything else (icons, labels, hrefs, badge
// counts, the ADMIN_NAV data itself) stays server-rendered and never reaches
// this file: the icon arrives pre-rendered as `icon`, not as a component
// reference, so lucide-react is not imported here.
//
// Import ONLY matchesAdminPath, never activeAdminNavKey or ADMIN_NAV from
// admin-nav-model.ts. activeAdminNavKey's closure captures the full
// ADMIN_NAV literal (every group label, href, badge key,
// requiresDiscussionQueuePermission flag) — webpack cannot tree-shake a
// function away from the module state its closure reads, so importing it
// here would ship the whole admin nav map into this client component's
// chunk, which loads for every visitor on every page (see ConsoleShell:
// adminSidebarSlot is built whenever the signed-in user's role is
// ADMIN/MODERATOR, not only on /admin/* routes). matchesAdminPath
// (lib/admin/admin-nav-match.ts) closes over nothing — it takes the one
// item's href/match as props — so this file carries no admin nav data.
import Link from "next/link"
import { usePathname } from "next/navigation"
import { matchesAdminPath } from "@/lib/admin/admin-nav-match"
import { cn } from "@/lib/utils"

const ROW =
    "flex items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-[13.5px] transition-colors duration-150"

interface AdminSidebarLinkProps {
    href: string
    /** This item's own match rule (AdminNavItem.match, defaulted upstream). */
    match: "exact" | "prefix"
    label: string
    /** Pre-rendered on the server via <item.icon />. */
    icon: React.ReactNode
    badgeCount?: number
}

export function AdminSidebarLink({
    href,
    match,
    label,
    icon,
    badgeCount,
}: AdminSidebarLinkProps) {
    const pathname = usePathname()
    const active = matchesAdminPath(pathname, href, match)

    return (
        <Link
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
                ROW,
                active
                    ? "bg-panel-active font-medium text-foreground shadow-sidebar-active"
                    : "text-text-muted hover:bg-panel-hover hover:text-foreground",
            )}
        >
            <span className={cn("shrink-0", active && "text-primary")}>{icon}</span>
            <span className="min-w-0 flex-1 truncate">{label}</span>
            {typeof badgeCount === "number" && badgeCount > 0 && (
                <span className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent/15 px-1 text-[10px] font-semibold tabular-nums text-accent">
                    {badgeCount}
                </span>
            )}
        </Link>
    )
}
