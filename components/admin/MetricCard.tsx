import Link from "next/link"
import { ArrowDown, ArrowRight, ArrowUp, Minus, type LucideIcon } from "lucide-react"
import type { AdminMetric } from "@/actions/admin-dashboard"
import type { DeltaDirection } from "@/lib/admin/metric-delta"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { cn } from "@/lib/utils"

const DELTA_ICON: Record<DeltaDirection, LucideIcon> = {
    up: ArrowUp,
    down: ArrowDown,
    flat: Minus,
}

// direction: "up" -> text-easy, "down" -> text-destructive, "flat" ->
// text-muted-foreground, per the brief. Not a fabricated "growth = good"
// judgment on the metric's meaning (e.g. more open reports isn't "good") —
// just the up/down/flat mapping the brief specifies verbatim.
const DELTA_COLOR: Record<DeltaDirection, string> = {
    up: "text-easy",
    down: "text-destructive",
    flat: "text-muted-foreground",
}

export function MetricCard({ metric }: { metric: AdminMetric }) {
    const delta = metric.delta
    const DeltaIcon = delta ? DELTA_ICON[delta.direction] : null
    const sign = delta && delta.change > 0 ? "+" : ""

    return (
        <Link
            href={metric.href}
            className="group block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-hover"
        >
            <div className="flex items-center justify-between gap-3">
                <Eyebrow>{metric.label}</Eyebrow>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
                {metric.value.toLocaleString()}
            </div>
            {/* No `delta` means no honest historical basis exists for this
                metric (see lib/admin/metric-delta.ts) — render nothing here,
                not a dash and not a grey zero. The card is simply shorter. */}
            {delta && DeltaIcon && (
                <div
                    className={cn(
                        "mt-1.5 flex items-center gap-1 text-xs font-medium tabular-nums",
                        DELTA_COLOR[delta.direction]
                    )}
                >
                    <DeltaIcon className="h-3 w-3" aria-hidden />
                    <span>
                        {sign}
                        {delta.change.toLocaleString()}
                    </span>
                </div>
            )}
        </Link>
    )
}
