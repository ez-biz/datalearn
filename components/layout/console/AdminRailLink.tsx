"use client"

// The rail's interactive leaf — icon-only cell, mirroring RailItem
// (ConsoleRail.tsx) for the learner nav, and AdminSidebarLink for the
// active-highlighting rule. ConsoleAdminRail (the server component that
// renders this) has no access to usePathname(), so that single concern is
// split into this tiny client leaf, exactly like AdminSidebarLink.
//
// Import ONLY matchesAdminPath, never activeAdminNavKey or ADMIN_NAV from
// admin-nav-model.ts — see AdminSidebarLink.tsx for why: activeAdminNavKey's
// closure captures the full ADMIN_NAV literal, and this component renders on
// every page for signed-in ADMIN/MODERATOR users (ConsoleShell builds the
// rail slot whenever the role qualifies, not only on /admin/* routes).
import Link from "next/link"
import { usePathname } from "next/navigation"
import { matchesAdminPath } from "@/lib/admin/admin-nav-match"
import { cn } from "@/lib/utils"

const CELL =
    "flex h-[34px] w-[34px] items-center justify-center rounded-md transition-colors duration-150"

interface AdminRailLinkProps {
    href: string
    /** This item's own match rule (AdminNavItem.match, defaulted upstream). */
    match: "exact" | "prefix"
    label: string
    /** Pre-rendered on the server via <item.icon />. */
    icon: React.ReactNode
}

export function AdminRailLink({ href, match, label, icon }: AdminRailLinkProps) {
    const pathname = usePathname()
    const active = matchesAdminPath(pathname, href, match)

    return (
        <Link
            href={href}
            aria-label={label}
            title={label}
            aria-current={active ? "page" : undefined}
            className={cn(
                CELL,
                active
                    ? "bg-panel-active text-primary shadow-sidebar-active"
                    : "text-text-dim hover:bg-panel-hover hover:text-foreground",
            )}
        >
            {icon}
        </Link>
    )
}
