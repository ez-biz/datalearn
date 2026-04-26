import { Skeleton } from "@/components/ui/Skeleton"

/**
 * Layout-matched skeleton for the SQL playground. Renders during the
 * dynamic-import + chunk-parse window of `SqlPlayground` so the right
 * pane never collapses to blank/spinner geometry. Box dimensions mirror
 * the real component: editor (flex-1) → toolbar row → results panel.
 */
export function SqlPlaygroundSkeleton() {
    return (
        <div className="flex flex-col h-full gap-3" aria-hidden="true">
            {/* Editor */}
            <div className="flex-1 min-h-0 rounded-lg border border-border bg-surface overflow-hidden">
                <div className="flex flex-col gap-2.5 p-4">
                    <Skeleton className="h-3 w-[42%]" />
                    <Skeleton className="h-3 w-[68%]" />
                    <Skeleton className="h-3 w-[28%]" />
                    <Skeleton className="h-3 w-[55%]" />
                    <Skeleton className="h-3 w-[36%]" />
                </div>
            </div>

            {/* Toolbar — tabs left, action buttons right */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                    <Skeleton className="h-7 w-20" />
                    <Skeleton className="h-7 w-20" />
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-16" />
                    <Skeleton className="h-8 w-20" />
                </div>
            </div>

            {/* Results panel */}
            <div className="h-[34vh] min-h-[260px] rounded-lg border border-border bg-surface" />
        </div>
    )
}
