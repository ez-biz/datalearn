"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface CollapsibleSectionProps {
    /** Mono uppercase label, e.g. "SCHEMA". */
    label: string
    /** Right-aligned meta, e.g. "2 tables". */
    meta?: string
    /** Optional action rendered in the header, e.g. "Preview rows". */
    action?: React.ReactNode
    defaultOpen: boolean
    children: React.ReactNode
}

/**
 * A `panel-raised` header row that folds its body away.
 *
 * `defaultOpen` is decided once by the caller from the first-visit flag —
 * open the first time a learner sees a problem, collapsed afterwards, so the
 * editor gets the space back once they know the schema. It is deliberately
 * uncontrolled after mount: toggling is a local, unpersisted affordance.
 */
export function CollapsibleSection({
    label,
    meta,
    action,
    defaultOpen,
    children,
}: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen)

    return (
        <section className="overflow-hidden rounded-md border border-border">
            <div className="flex items-center gap-2 bg-panel-raised px-3 py-2">
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                    <ChevronRight
                        className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
                            open && "rotate-90"
                        )}
                        aria-hidden
                    />
                    <span className="font-mono text-[11px] uppercase tracking-wider text-text-2">
                        {label}
                    </span>
                    {meta && (
                        <span className="truncate text-[11px] tabular-nums text-muted-foreground">
                            {meta}
                        </span>
                    )}
                </button>
                {action}
            </div>
            {open && <div className="border-t border-border">{children}</div>}
        </section>
    )
}
