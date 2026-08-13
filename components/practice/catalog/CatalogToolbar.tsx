"use client"

import type { RefObject } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/Input"
import { Kbd } from "@/components/ui/Kbd"
import type { CatalogSort } from "@/lib/practice/catalog-model"

const SORTS: { key: CatalogSort; label: string }[] = [
    { key: "curriculum", label: "Curriculum order" },
    { key: "newest", label: "Newest" },
    { key: "pass-rate", label: "Pass rate" },
]

interface CatalogToolbarProps {
    search: string
    onSearchChange: (value: string) => void
    searchInputRef: RefObject<HTMLInputElement | null>
    sort: CatalogSort
    onSortChange: (sort: CatalogSort) => void
    filteredCount: number
    totalCount: number
}

/**
 * The bar above the table: search, the curriculum/newest/pass-rate sort
 * (a mono segmented control, same shape as `ProblemsPanel`'s grouping
 * toggle), and the filtered-count readout the facet rail's counts and the
 * table's row count both have to agree with.
 */
export function CatalogToolbar({
    search,
    onSearchChange,
    searchInputRef,
    sort,
    onSortChange,
    filteredCount,
    totalCount,
}: CatalogToolbarProps) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-line-soft bg-panel-sunken p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
                <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim"
                    aria-hidden="true"
                />
                <Input
                    ref={searchInputRef}
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search problems…"
                    aria-label="Search problems"
                    className="h-9 bg-panel pl-9 pr-10 text-[13px]"
                />
                <Kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 sm:inline-flex">
                    /
                </Kbd>
            </div>

            <div className="flex items-center gap-3">
                <div
                    role="group"
                    aria-label="Sort"
                    className="flex items-center gap-1 rounded-md border border-line-soft bg-panel p-1"
                >
                    {SORTS.map((s) => {
                        const active = sort === s.key
                        return (
                            <button
                                key={s.key}
                                type="button"
                                onClick={() => onSortChange(s.key)}
                                aria-pressed={active}
                                className={cn(
                                    "rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors duration-150",
                                    active
                                        ? "bg-panel-active text-foreground"
                                        : "text-text-dim hover:bg-panel-hover hover:text-text-3"
                                )}
                            >
                                {s.label}
                            </button>
                        )
                    })}
                </div>
                <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-text-dim">
                    Showing {filteredCount} of {totalCount}
                </span>
            </div>
        </div>
    )
}
