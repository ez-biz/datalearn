import Link from "next/link"
import { ArrowDown, ArrowUp, Minus, type LucideIcon } from "lucide-react"
import type { DeltaDirection, MetricDelta } from "@/lib/admin/metric-delta"
import {
    deltaToneFor,
    type DeltaTone,
    type Polarity,
} from "@/lib/analytics/delta-tone"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { cn } from "@/lib/utils"

// Deliberately not components/admin/MetricCard: that renders as a <Link>
// and requires an href, which several figures here (retention, active
// learners) do not have, and its delta colouring is hardcoded up=green so
// it cannot express a metric where rising is bad.
const TONE_CLASS: Record<DeltaTone, string> = {
    positive: "text-easy",
    negative: "text-destructive",
    neutral: "text-muted-foreground",
}

const DIRECTION_ICON: Record<DeltaDirection, LucideIcon> = {
    up: ArrowUp,
    down: ArrowDown,
    flat: Minus,
}

export function StatTile({
    label,
    value,
    delta,
    polarity = "neutral",
    href,
    footnote,
}: {
    label: string
    /** Pre-formatted: callers decide between a count, a percentage, or an
     *  honest zero-state string like "No submissions yet". */
    value: string
    /** null/undefined when no honest delta exists — computeDelta returns
     *  null in that case and we render no delta line at all. */
    delta?: MetricDelta | null
    polarity?: Polarity
    href?: string
    /** Context the number needs to be honest, e.g. the denominator behind
     *  a percentage, or the window a count covers. */
    footnote?: string
}) {
    const tone = delta ? deltaToneFor(delta.direction, polarity) : "neutral"
    const Icon = delta ? DIRECTION_ICON[delta.direction] : null

    const body = (
        <>
            <Eyebrow>{label}</Eyebrow>
            <div className="mt-3 text-3xl font-semibold tabular-nums">{value}</div>
            {delta && Icon ? (
                <div
                    className={cn(
                        "mt-2 flex items-center gap-1 text-sm tabular-nums",
                        TONE_CLASS[tone]
                    )}
                >
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                        {delta.change > 0 ? "+" : ""}
                        {delta.change.toLocaleString()}
                    </span>
                </div>
            ) : null}
            {footnote ? (
                <p className="mt-2 text-xs text-muted-foreground">{footnote}</p>
            ) : null}
        </>
    )

    const base = "block rounded-lg border border-border bg-surface p-4"

    if (!href) {
        return <div className={base}>{body}</div>
    }

    return (
        <Link
            href={href}
            className={cn(
                base,
                "transition-colors hover:border-border-strong hover:bg-surface-hover"
            )}
        >
            {body}
        </Link>
    )
}
