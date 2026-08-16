import Link from "next/link"
import { Flag, BookOpen, MessageSquareWarning, type LucideIcon } from "lucide-react"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { cn } from "@/lib/utils"

export interface QueueCardData {
    count: number
    href: string
}

export interface QueueStackProps {
    openReports: QueueCardData
    pendingArticles: QueueCardData
    flaggedComments: QueueCardData
}

type Tint = "destructive" | "warning" | "accent"

const TINT_CLASSES: Record<
    Tint,
    { tile: string; count: string; border: string; button: string }
> = {
    destructive: {
        tile: "bg-destructive/10 text-destructive",
        count: "text-destructive",
        border: "border-destructive/20",
        button:
            "border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50",
    },
    warning: {
        tile: "bg-warning/10 text-warning",
        count: "text-warning",
        border: "border-warning/20",
        button:
            "border-warning/30 text-warning hover:bg-warning/10 hover:border-warning/50",
    },
    accent: {
        tile: "bg-accent/15 text-accent",
        count: "text-accent",
        border: "border-accent/20",
        button:
            "border-accent/30 text-accent hover:bg-accent/10 hover:border-accent/50",
    },
}

interface QueueDef {
    key: string
    label: string
    icon: LucideIcon
    verb: string
    tint: Tint
    data: QueueCardData
}

/** A queue depth with nothing waiting is good news — the empty state says
 *  so explicitly rather than falling back to a bare "0" or hiding the card.
 *  A missing card reads as a bug; an explicitly empty one reads as done. */
export function QueueStack({
    openReports,
    pendingArticles,
    flaggedComments,
}: QueueStackProps) {
    const queues: QueueDef[] = [
        {
            key: "reports",
            label: "Open reports",
            icon: Flag,
            verb: "Triage",
            tint: "destructive",
            data: openReports,
        },
        {
            key: "articles",
            label: "Articles awaiting review",
            icon: BookOpen,
            verb: "Review",
            tint: "warning",
            data: pendingArticles,
        },
        {
            key: "discussions",
            label: "Flagged comments",
            icon: MessageSquareWarning,
            verb: "Moderate",
            tint: "accent",
            data: flaggedComments,
        },
    ]

    return (
        <section className="flex flex-col gap-3">
            <Eyebrow variant="bracket">QUEUES</Eyebrow>
            {queues.map((queue) => (
                <QueueCard key={queue.key} queue={queue} />
            ))}
        </section>
    )
}

function QueueCard({ queue }: { queue: QueueDef }) {
    const Icon = queue.icon
    const tint = TINT_CLASSES[queue.tint]
    const empty = queue.data.count === 0

    return (
        <div
            className={cn(
                "flex items-center justify-between gap-3 rounded-lg border bg-surface p-4",
                tint.border
            )}
        >
            <div className="flex min-w-0 items-center gap-3">
                <span
                    className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                        tint.tile
                    )}
                >
                    <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-foreground">
                        {queue.label}
                    </div>
                    {empty ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            Nothing waiting
                        </div>
                    ) : (
                        <div
                            className={cn(
                                "mt-0.5 text-2xl font-semibold tabular-nums",
                                tint.count
                            )}
                        >
                            {queue.data.count.toLocaleString()}
                        </div>
                    )}
                </div>
            </div>
            <Link
                href={queue.data.href}
                className={cn(
                    "inline-flex h-8 shrink-0 items-center rounded-md border bg-surface px-3 text-xs font-medium transition-colors",
                    tint.button
                )}
            >
                {queue.verb}
            </Link>
        </div>
    )
}
