import Link from "next/link"
import {
    AlertTriangle,
    CheckCircle2,
    FileText,
    type LucideIcon,
} from "lucide-react"
import type { AdminActivityItem } from "@/actions/admin-dashboard"
import { Eyebrow } from "@/components/ui/Eyebrow"

const ACTIVITY_ICON: Record<AdminActivityItem["kind"], LucideIcon> = {
    submission: CheckCircle2,
    "article-submitted": FileText,
    "problem-reported": AlertTriangle,
}

export function RecentActivityFeed({
    items,
}: {
    items: AdminActivityItem[]
}) {
    return (
        <section className="rounded-lg border border-border bg-surface">
            <div className="border-b border-border px-4 py-3">
                <Eyebrow variant="bracket">RECENT ACTIVITY</Eyebrow>
            </div>
            <ul className="divide-y divide-border">
                {items.length === 0 ? (
                    <li className="px-4 py-8 text-sm text-muted-foreground">
                        No activity in the last 14 days.
                    </li>
                ) : (
                    items.map((item) => {
                        const Icon = ACTIVITY_ICON[item.kind]
                        return (
                            <li key={item.id}>
                                <Link
                                    href={item.href}
                                    className="grid grid-cols-[auto_1fr] gap-3 px-4 py-3 text-sm transition-colors hover:bg-surface-muted/60"
                                >
                                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-muted text-muted-foreground">
                                        <Icon className="h-3.5 w-3.5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block font-medium">
                                            {item.label}
                                        </span>
                                        <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                                            {item.detail}
                                        </span>
                                        <span className="mt-1 block font-mono text-[11px] text-muted-foreground-dim">
                                            {formatRelative(item.timestamp)}
                                        </span>
                                    </span>
                                </Link>
                            </li>
                        )
                    })
                )}
            </ul>
        </section>
    )
}

function formatRelative(date: Date) {
    const diffMs = Date.now() - date.getTime()
    const minutes = Math.max(1, Math.round(diffMs / 60_000))
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 14) return `${days}d ago`
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}
