import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { AdminMetric } from "@/actions/admin-dashboard"
import { Eyebrow } from "@/components/ui/Eyebrow"

export function MetricCard({ metric }: { metric: AdminMetric }) {
    return (
        <Link
            href={metric.href}
            className="group block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted/50"
        >
            <div className="flex items-center justify-between gap-3">
                <Eyebrow>{metric.label}</Eyebrow>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-[color,translate] group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <div className="mt-3 text-3xl font-semibold tabular-nums">
                {metric.value.toLocaleString()}
            </div>
        </Link>
    )
}
