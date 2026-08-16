// The admin sidebar's nav model. Ports the flat item list from the old
// components/admin/AdminNav.tsx into grouped sections; the icons, hrefs,
// badge keys and role-filter semantics carry over unchanged so the new
// sidebar reads identically to the old row.
//
// Pure module: no React, no Prisma, no DOM. Consumed by the (future) admin
// sidebar component and unit-tested standalone.

import type { LucideIcon } from "lucide-react"
import {
    BookOpen,
    CalendarCheck2,
    Trophy,
    Database,
    Flag,
    FileCode,
    FolderOpen,
    Key,
    LayoutDashboard,
    MessageSquareText,
    Route,
    ShieldCheck,
    Tag,
    Users,
} from "lucide-react"
import { matchesAdminPath } from "./admin-nav-match"

export type AdminBadgeKey = "openReports" | "articleQueue" | "discussionQueue"

export interface AdminNavItem {
    key: string
    label: string
    icon: LucideIcon
    href: string
    /** Defaults to "prefix". */
    match?: "exact" | "prefix"
    badgeKey?: AdminBadgeKey
    requiresDiscussionQueuePermission?: boolean
}

export interface AdminNavGroup {
    /** null for the ungrouped leading items. */
    label: string | null
    items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavGroup[] = [
    {
        label: null,
        items: [
            {
                key: "overview",
                label: "Overview",
                icon: LayoutDashboard,
                href: "/admin",
                match: "exact",
            },
        ],
    },
    {
        label: "Content",
        items: [
            {
                key: "problems",
                label: "Problems",
                icon: Database,
                href: "/admin/problems",
            },
            {
                key: "schemas",
                label: "Schemas",
                icon: FileCode,
                href: "/admin/schemas",
            },
            {
                key: "topics",
                label: "Topics",
                icon: FolderOpen,
                href: "/admin/topics",
            },
            {
                key: "tracks",
                label: "Tracks",
                icon: Route,
                href: "/admin/tracks",
            },
            {
                key: "articles",
                label: "Articles",
                icon: BookOpen,
                href: "/admin/articles",
                badgeKey: "articleQueue",
            },
            {
                key: "tags",
                label: "Tags",
                icon: Tag,
                href: "/admin/tags",
            },
        ],
    },
    {
        label: "Scheduling",
        items: [
            {
                key: "daily",
                label: "Daily",
                icon: CalendarCheck2,
                href: "/admin/daily",
            },
            {
                key: "contests",
                label: "Contests",
                icon: Trophy,
                href: "/admin/contests",
            },
        ],
    },
    {
        label: "Moderation",
        items: [
            {
                key: "reports",
                label: "Reports",
                icon: Flag,
                href: "/admin/reports",
                badgeKey: "openReports",
            },
            {
                key: "discussions",
                label: "Discussions",
                icon: MessageSquareText,
                href: "/admin/discussions",
                badgeKey: "discussionQueue",
                requiresDiscussionQueuePermission: true,
            },
        ],
    },
    {
        label: "People & access",
        items: [
            {
                key: "moderators",
                label: "Moderators",
                icon: ShieldCheck,
                href: "/admin/moderators",
            },
            {
                key: "contributors",
                label: "Contributors",
                icon: Users,
                href: "/admin/contributors",
            },
            {
                key: "api-keys",
                label: "API keys",
                icon: Key,
                href: "/admin/api-keys",
            },
        ],
    },
]

export interface AdminNavViewer {
    role: "ADMIN" | "MODERATOR"
    canViewDiscussionQueue: boolean
}

function isItemVisible(item: AdminNavItem, viewer: AdminNavViewer): boolean {
    if (viewer.role === "ADMIN") return true
    // Mirrors the old AdminNav filter (components/admin/AdminNav.tsx:100-104):
    // a MODERATOR sees only items gated on discussion-queue permission, and
    // only once that permission is granted.
    return Boolean(item.requiresDiscussionQueuePermission) && viewer.canViewDiscussionQueue
}

/** Groups the viewer may see. A group whose items all filter out is dropped
 *  entirely — never rendered as an empty heading. */
export function visibleAdminNav(viewer: AdminNavViewer): AdminNavGroup[] {
    const groups: AdminNavGroup[] = []
    for (const group of ADMIN_NAV) {
        const items = group.items.filter((item) => isItemVisible(item, viewer))
        if (items.length === 0) continue
        groups.push({ label: group.label, items })
    }
    return groups
}

/** Active item key for a pathname, or null. Longest prefix wins. */
export function activeAdminNavKey(pathname: string): string | null {
    let best: AdminNavItem | null = null
    for (const group of ADMIN_NAV) {
        for (const item of group.items) {
            if (!matchesAdminPath(pathname, item.href, item.match ?? "prefix")) continue
            if (!best || item.href.length > best.href.length) {
                best = item
            }
        }
    }
    return best?.key ?? null
}
