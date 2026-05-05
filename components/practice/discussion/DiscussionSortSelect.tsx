"use client"

import type { DiscussionSort } from "./DiscussionPanel"

interface DiscussionSortSelectProps {
    value: DiscussionSort
    onChange: (value: DiscussionSort) => void
    disabled?: boolean
}

export function DiscussionSortSelect({
    value,
    onChange,
    disabled,
}: DiscussionSortSelectProps) {
    return (
        <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            Sort
            <select
                value={value}
                onChange={(event) => onChange(event.target.value as DiscussionSort)}
                disabled={disabled}
                className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-medium text-foreground shadow-sm outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
            >
                <option value="best">Best</option>
                <option value="votes">Top</option>
                <option value="latest">Latest</option>
            </select>
        </label>
    )
}
