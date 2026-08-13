"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type {
    CatalogFacets,
    CatalogFilters,
    FacetCount,
} from "@/lib/practice/catalog-model"

export type FacetGroupKey = keyof CatalogFacets

interface FacetRailProps {
    facets: CatalogFacets
    filters: CatalogFilters
    onToggle: (group: FacetGroupKey, value: string) => void
}

/**
 * The catalog's left rail: Status / Difficulty / Engine as checkbox groups,
 * Topics as a chip cloud, Companies as toggleable rows. Every group is
 * multi-select — clicking a value adds or removes it from that group's
 * selection in `filters`. All of the state lives one level up in
 * `CatalogClient`; this component only renders `facets` (this group's
 * counts, computed against every OTHER group's current selection — see
 * `computeFacets`) and reports clicks.
 */
export function FacetRail({ facets, filters, onToggle }: FacetRailProps) {
    return (
        <div className="w-full shrink-0 space-y-5 rounded-lg border border-line-soft bg-panel p-4 lg:w-[236px]">
            <CheckboxGroup
                title="Status"
                options={facets.status}
                selected={filters.status}
                onToggle={(value) => onToggle("status", value)}
            />
            <CheckboxGroup
                title="Difficulty"
                options={facets.difficulty}
                selected={filters.difficulty}
                onToggle={(value) => onToggle("difficulty", value)}
            />
            <CheckboxGroup
                title="Engine"
                options={facets.engine}
                selected={filters.engine}
                onToggle={(value) => onToggle("engine", value)}
            />
            {/* Always rendered, even with zero topic chips to show — this is
                the catalog's only click path to the full tag index now that
                the redesigned header dropped the old "Browse by tag" link. */}
            <ChipGroup
                title="Topics"
                options={facets.topics}
                selected={filters.topics}
                onToggle={(value) => onToggle("topics", value)}
                headerLink={{ href: "/practice/tags", label: "All tags" }}
            />
            {facets.companies.length > 0 && (
                <RowGroup
                    title="Companies"
                    options={facets.companies}
                    selected={filters.companies}
                    onToggle={(value) => onToggle("companies", value)}
                />
            )}
        </div>
    )
}

function GroupHeading({
    children,
    className,
}: {
    children: React.ReactNode
    className?: string
}) {
    return (
        <h3
            className={cn(
                "mb-2 font-mono text-[10px] uppercase tracking-wider text-text-dim",
                className
            )}
        >
            {children}
        </h3>
    )
}

/** Status / Difficulty / Engine: `12px checkbox · name · count`. */
function CheckboxGroup({
    title,
    options,
    selected,
    onToggle,
}: {
    title: string
    options: FacetCount[]
    selected: string[]
    onToggle: (value: string) => void
}) {
    return (
        <fieldset>
            <GroupHeading>{title}</GroupHeading>
            <div className="space-y-1.5">
                {options.map((option) => {
                    const checked = selected.includes(option.value)
                    return (
                        <label
                            key={option.value}
                            className="flex cursor-pointer items-center gap-2 text-[13px] text-text-3 hover:text-foreground"
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => onToggle(option.value)}
                                className="h-3 w-3 shrink-0 accent-primary"
                            />
                            <span className="flex-1 truncate">{option.label}</span>
                            <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                {option.count}
                            </span>
                        </label>
                    )
                })}
            </div>
        </fieldset>
    )
}

/** Topics: a mono chip cloud, no counts — the tag universe is open-ended. */
function ChipGroup({
    title,
    options,
    selected,
    onToggle,
    headerLink,
}: {
    title: string
    options: FacetCount[]
    selected: string[]
    onToggle: (value: string) => void
    /** Rendered next to the heading regardless of whether `options` is
     *  empty — used by Topics to keep a working link to the full tag index
     *  even when the current filter combination has no topic chips left. */
    headerLink?: { href: string; label: string }
}) {
    return (
        <div>
            <div className="mb-2 flex items-center justify-between gap-2">
                <GroupHeading className="mb-0">{title}</GroupHeading>
                {headerLink && (
                    <Link
                        href={headerLink.href}
                        className="font-mono text-[10px] text-text-dim transition-colors duration-150 hover:text-primary"
                    >
                        {headerLink.label}
                    </Link>
                )}
            </div>
            {options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {options.map((option) => {
                        const active = selected.includes(option.value)
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => onToggle(option.value)}
                                aria-pressed={active}
                                className={cn(
                                    "rounded-full border px-2 py-0.5 font-mono text-[10px] lowercase transition-colors duration-150",
                                    active
                                        ? "border-primary/30 bg-primary/10 text-primary"
                                        : "border-line-soft bg-panel-sunken text-text-3 hover:border-line-strong hover:text-foreground"
                                )}
                            >
                                {option.label}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/** Companies: `name · count` rows, toggled the same way as the chips. */
function RowGroup({
    title,
    options,
    selected,
    onToggle,
}: {
    title: string
    options: FacetCount[]
    selected: string[]
    onToggle: (value: string) => void
}) {
    return (
        <div>
            <GroupHeading>{title}</GroupHeading>
            <div className="space-y-0.5">
                {options.map((option) => {
                    const active = selected.includes(option.value)
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onToggle(option.value)}
                            aria-pressed={active}
                            className={cn(
                                "flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] transition-colors duration-150",
                                active
                                    ? "bg-primary/10 text-primary"
                                    : "text-text-3 hover:bg-panel-hover hover:text-foreground"
                            )}
                        >
                            <span className="flex-1 truncate">{option.label}</span>
                            <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                {option.count}
                            </span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
