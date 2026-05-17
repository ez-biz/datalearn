import Link from "next/link"
import { CheckCircle2, Circle, PlayCircle } from "lucide-react"
import type { TrackDetail } from "@/actions/tracks"
import { DifficultyBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"

type TrackItem = TrackDetail["items"][number]

type TrackItemRowProps = {
    item: TrackItem
    isCompleted: boolean
    isNext: boolean
}

export function TrackItemRow({ item, isCompleted, isNext }: TrackItemRowProps) {
    const stateLabel = isCompleted ? "Solved" : isNext ? "Next" : "Queued"
    const StateIcon = isCompleted ? CheckCircle2 : isNext ? PlayCircle : Circle

    return (
        <Link
            href={`/practice/${item.problem.slug}`}
            data-testid="track-item"
            className={cn(
                "group grid grid-cols-[auto_1fr] gap-4 border-b border-border p-4 transition-colors last:border-b-0 hover:bg-surface-muted/60 sm:grid-cols-[auto_1fr_auto]",
                isNext && "bg-primary/5",
            )}
        >
            <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-xs font-medium tabular-nums text-muted-foreground">
                {String(item.position + 1).padStart(2, "0")}
            </div>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-medium text-foreground transition-colors group-hover:text-primary">
                        {item.problem.number}. {item.problem.title}
                    </h2>
                    <DifficultyBadge difficulty={item.problem.difficulty} />
                </div>
                <div
                    data-testid={`track-item-${item.problem.slug}`}
                    className={cn(
                        "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium",
                        isCompleted
                            ? "bg-easy-bg text-easy-fg"
                            : isNext
                              ? "bg-primary/10 text-primary"
                              : "bg-surface-muted text-muted-foreground",
                    )}
                >
                    <StateIcon className="h-3.5 w-3.5" />
                    {stateLabel}
                </div>
            </div>
            <div className="col-start-2 text-sm text-primary opacity-0 transition-opacity group-hover:opacity-100 sm:col-start-auto sm:self-center">
                Open
            </div>
        </Link>
    )
}
