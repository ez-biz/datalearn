"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BookOpen,
    CalendarCheck2,
    Database,
    Flag,
    FileCode,
    FolderOpen,
    Key,
    LayoutDashboard,
    MessageSquareText,
    Tag,
    Users,
} from "lucide-react"
import { cn } from "@/lib/utils"

type AdminRole = "ADMIN" | "MODERATOR"
type BadgeKey = "openReports" | "articleQueue" | "discussionQueue"

const items: {
    href: string
    label: string
    icon: typeof Database
    exact?: boolean
    badgeKey?: BadgeKey
    adminOnly?: boolean
    requiresDiscussionQueuePermission?: boolean
}[] = [
    {
        href: "/admin",
        label: "Overview",
        icon: LayoutDashboard,
        exact: true,
        adminOnly: true,
    },
    { href: "/admin/daily", label: "Daily", icon: CalendarCheck2, adminOnly: true },
    { href: "/admin/problems", label: "Problems", icon: Database, adminOnly: true },
    { href: "/admin/schemas", label: "Schemas", icon: FileCode, adminOnly: true },
    { href: "/admin/topics", label: "Topics", icon: FolderOpen, adminOnly: true },
    {
        href: "/admin/articles",
        label: "Articles",
        icon: BookOpen,
        badgeKey: "articleQueue",
        adminOnly: true,
    },
    { href: "/admin/tags", label: "Tags", icon: Tag, adminOnly: true },
    {
        href: "/admin/reports",
        label: "Reports",
        icon: Flag,
        badgeKey: "openReports",
        adminOnly: true,
    },
    {
        href: "/admin/discussions",
        label: "Discussions",
        icon: MessageSquareText,
        badgeKey: "discussionQueue",
        requiresDiscussionQueuePermission: true,
    },
    { href: "/admin/contributors", label: "Contributors", icon: Users, adminOnly: true },
    { href: "/admin/api-keys", label: "API keys", icon: Key, adminOnly: true },
]

export function AdminNav({
    role,
    openReportCount = 0,
    articleQueueCount = 0,
    canViewDiscussionQueue = false,
    discussionQueueCount = 0,
}: {
    role: AdminRole
    openReportCount?: number
    articleQueueCount?: number
    canViewDiscussionQueue?: boolean
    discussionQueueCount?: number
}) {
    const pathname = usePathname()
    function badgeFor(key?: BadgeKey): number {
        if (key === "openReports") return openReportCount
        if (key === "articleQueue") return articleQueueCount
        if (key === "discussionQueue") return discussionQueueCount
        return 0
    }
    const visibleItems = items.filter((item) =>
        role === "ADMIN"
            ? true
            : item.requiresDiscussionQueuePermission && canViewDiscussionQueue
    )

    return (
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-border bg-surface px-4 sm:px-6">
            {visibleItems.map((item) => {
                const Icon = item.icon
                const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname?.startsWith(`${item.href}/`)
                const count = badgeFor(item.badgeKey)
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "relative inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors",
                            active
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                        {item.badgeKey && count > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent/15 text-accent text-[10px] font-semibold tabular-nums px-1">
                                {count}
                            </span>
                        )}
                        {active && (
                            <span
                                aria-hidden
                                className="absolute left-3 right-3 -bottom-px h-0.5 rounded-full bg-primary"
                            />
                        )}
                    </Link>
                )
            })}
        </nav>
    )
}
