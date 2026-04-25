"use client"

import Link from "next/link"
import type { ArticleStatus } from "@prisma/client"
import { cn } from "@/lib/utils"

const TABS: { status: ArticleStatus | null; label: string }[] = [
    { status: null, label: "All" },
    { status: "DRAFT", label: "Draft" },
    { status: "SUBMITTED", label: "In review" },
    { status: "PUBLISHED", label: "Published" },
    { status: "ARCHIVED", label: "Archived" },
]

export function ArticleStatusTabs({
    total,
    counts,
    active,
}: {
    total: number
    counts: Partial<Record<ArticleStatus, number>>
    active: ArticleStatus | null
}) {
    return (
        <nav className="flex flex-wrap items-center gap-1 mb-5 border-b border-border">
            {TABS.map((tab) => {
                const isActive = tab.status === active
                const count = tab.status === null ? total : counts[tab.status] ?? 0
                return (
                    <Link
                        key={tab.label}
                        href={
                            tab.status === null
                                ? "/admin/articles"
                                : `/admin/articles?status=${tab.status}`
                        }
                        className={cn(
                            "relative inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors -mb-px",
                            isActive
                                ? "text-foreground border-b-2 border-primary"
                                : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                        )}
                    >
                        {tab.label}
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                            {count}
                        </span>
                    </Link>
                )
            })}
        </nav>
    )
}
