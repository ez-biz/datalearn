"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
    BookOpen,
    Database,
    Flag,
    FileCode,
    FolderOpen,
    Key,
    LayoutDashboard,
    Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"

type BadgeKey = "openReports" | "articleQueue"

const items: {
    href: string
    label: string
    icon: typeof Database
    exact?: boolean
    badgeKey?: BadgeKey
}[] = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/admin/problems", label: "Problems", icon: Database },
    { href: "/admin/schemas", label: "Schemas", icon: FileCode },
    { href: "/admin/topics", label: "Topics", icon: FolderOpen },
    {
        href: "/admin/articles",
        label: "Articles",
        icon: BookOpen,
        badgeKey: "articleQueue",
    },
    { href: "/admin/tags", label: "Tags", icon: Tag },
    {
        href: "/admin/reports",
        label: "Reports",
        icon: Flag,
        badgeKey: "openReports",
    },
    { href: "/admin/api-keys", label: "API keys", icon: Key },
]

export function AdminNav({
    openReportCount = 0,
    articleQueueCount = 0,
}: {
    openReportCount?: number
    articleQueueCount?: number
}) {
    const pathname = usePathname()
    function badgeFor(key?: BadgeKey): number {
        if (key === "openReports") return openReportCount
        if (key === "articleQueue") return articleQueueCount
        return 0
    }
    return (
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-border bg-surface px-4 sm:px-6">
            {items.map((item) => {
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
