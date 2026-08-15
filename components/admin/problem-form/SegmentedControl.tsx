"use client"

import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
    value: T
    label: string
    /** Override the active-state classes for this option (e.g. difficulty color-coding). */
    activeClassName?: string
}

interface SegmentedControlProps<T extends string> {
    id: string
    label: string
    options: SegmentedOption<T>[]
    value: T
    onChange: (value: T) => void
    description?: string
}

/**
 * Single-select pill strip, replacing a native `<select>` for short
 * option lists (Difficulty, Status). Same `role="group"` + `aria-pressed`
 * interaction model as the status filter in `ProblemsListClient` — this
 * is presentation only, `value`/`onChange` carry the identical enum
 * values a `<select>` would, so the submitted payload is unchanged.
 */
export function SegmentedControl<T extends string>({
    id,
    label,
    options,
    value,
    onChange,
    description,
}: SegmentedControlProps<T>) {
    return (
        <div className="space-y-1.5">
            <span id={`${id}-label`} className="block text-sm font-medium text-foreground">
                {label}
            </span>
            <div
                role="group"
                aria-labelledby={`${id}-label`}
                className="inline-flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1"
            >
                {options.map((opt) => {
                    const active = opt.value === value
                    return (
                        <button
                            key={opt.value}
                            type="button"
                            id={`${id}-${opt.value}`}
                            aria-pressed={active}
                            onClick={() => onChange(opt.value)}
                            className={cn(
                                "rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active
                                    ? (opt.activeClassName ?? "bg-primary/10 text-primary")
                                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                            )}
                        >
                            {opt.label}
                        </button>
                    )
                })}
            </div>
            {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
    )
}
