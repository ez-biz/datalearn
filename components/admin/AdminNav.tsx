"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Database, FileCode, Key, LayoutDashboard, Tag } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
    { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    { href: "/admin/problems", label: "Problems", icon: Database },
    { href: "/admin/schemas", label: "Schemas", icon: FileCode },
    { href: "/admin/tags", label: "Tags", icon: Tag },
    { href: "/admin/api-keys", label: "API keys", icon: Key },
]

export function AdminNav() {
    const pathname = usePathname()
    return (
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-border bg-surface px-4 sm:px-6">
            {items.map((item) => {
                const Icon = item.icon
                const active = item.exact
                    ? pathname === item.href
                    : pathname === item.href || pathname?.startsWith(`${item.href}/`)
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
