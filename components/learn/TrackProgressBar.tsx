import { cn } from "@/lib/utils"

type TrackProgressBarProps = {
    completedCount: number
    totalCount: number
    className?: string
}

export function TrackProgressBar({
    completedCount,
    totalCount,
    className,
}: TrackProgressBarProps) {
    const percent =
        totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100)

    return (
        <div className={cn("space-y-2", className)}>
            <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium tabular-nums">
                    {completedCount} / {totalCount} complete
                </span>
                <span className="text-muted-foreground tabular-nums">
                    {percent}%
                </span>
            </div>
            <div
                className="h-2 overflow-hidden rounded-full bg-surface-muted"
                role="progressbar"
                aria-label="Track progress"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                />
            </div>
        </div>
    )
}
