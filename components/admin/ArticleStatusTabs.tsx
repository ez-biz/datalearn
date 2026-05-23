"use client"

import Link from "next/link"
import type { ArticleStatus } from "@prisma/client"
import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/shadcn/tabs"

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
    const activeValue = active ?? "ALL"

    return (
        <Tabs value={activeValue} className="mb-5">
            <TabsList variant="line" className="flex-wrap justify-start">
                {TABS.map((tab) => {
                    const value = tab.status ?? "ALL"
                    const count =
                        tab.status === null ? total : counts[tab.status] ?? 0
                    return (
                        <TabsTrigger key={tab.label} value={value} asChild>
                            <Link
                                href={
                                    tab.status === null
                                        ? "/admin/articles"
                                        : `/admin/articles?status=${tab.status}`
                                }
                            >
                                {tab.label}
                                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {count}
                                </span>
                            </Link>
                        </TabsTrigger>
                    )
                })}
            </TabsList>
        </Tabs>
    )
}
