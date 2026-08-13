"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
    EMPTY_FILTERS,
    computeFacets,
    filterCatalog,
    type CatalogFilters,
    type CatalogSort,
} from "@/lib/practice/catalog-model"
import type { CatalogProblem } from "@/lib/practice/catalog-read"
import { shouldWarmPostgres, warmSqlEngine } from "@/lib/sql-engine/warmup"
import { FacetRail, type FacetGroupKey } from "@/components/practice/catalog/FacetRail"
import { CatalogToolbar } from "@/components/practice/catalog/CatalogToolbar"
import { CatalogTable } from "@/components/practice/catalog/CatalogTable"

function toggleFacet(
    filters: CatalogFilters,
    group: FacetGroupKey,
    value: string
): CatalogFilters {
    const current = filters[group] as string[]
    const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    return { ...filters, [group]: next } as CatalogFilters
}

/**
 * Owns the catalog's client-side state — `filters` and `sort`, both local
 * per the plan (the whole catalog is already in memory, so URL-syncing
 * filters would only buy re-render churn) — and composes the facet rail,
 * toolbar and table around it. `app/practice/page.tsx` stays a server
 * component; this is the one client boundary the page crosses.
 *
 * Also owns two of the three carried-over PracticeList behaviours that
 * appear in no design screen: the SQL-engine prefetch on mount, and the `/`
 * shortcut that focuses search. (The third, tag-pill overflow, lives in
 * `CatalogRow`.)
 */
export function CatalogClient({ problems }: { problems: CatalogProblem[] }) {
    const [filters, setFilters] = useState<CatalogFilters>(EMPTY_FILTERS)
    const [sort, setSort] = useState<CatalogSort>("curriculum")
    const searchInputRef = useRef<HTMLInputElement>(null)

    // Warm the DuckDB-WASM engine while the learner is still browsing the
    // catalog, so `engine.init.ready` is typically near-zero by the time
    // they open a problem. Also pre-import the PGlite module for learners
    // who have used Postgres mode before — the cheap half of PGlite
    // startup; the instance itself stays per-problem and lazy.
    useEffect(() => {
        warmSqlEngine("DUCKDB")
        if (
            typeof window !== "undefined" &&
            shouldWarmPostgres(window.localStorage)
        ) {
            warmSqlEngine("POSTGRES")
        }
    }, [])

    // "/" focuses search, unless the learner is already typing somewhere
    // (an input/textarea/contenteditable) or holding a modifier — the same
    // convention GitHub's search shortcut uses.
    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
                return
            }
            const target = event.target as HTMLElement | null
            const tag = target?.tagName
            if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
                return
            }
            event.preventDefault()
            searchInputRef.current?.focus()
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [])

    const facets = useMemo(() => computeFacets(problems, filters), [problems, filters])
    const filtered = useMemo(
        () => filterCatalog(problems, filters, sort),
        [problems, filters, sort]
    )

    function handleToggle(group: FacetGroupKey, value: string) {
        setFilters((prev) => toggleFacet(prev, group, value))
    }

    return (
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
            <FacetRail facets={facets} filters={filters} onToggle={handleToggle} />
            <div className="min-w-0 flex-1 space-y-3">
                <CatalogToolbar
                    search={filters.search}
                    onSearchChange={(search) =>
                        setFilters((prev) => ({ ...prev, search }))
                    }
                    searchInputRef={searchInputRef}
                    sort={sort}
                    onSortChange={setSort}
                    filteredCount={filtered.length}
                    totalCount={problems.length}
                />
                <CatalogTable problems={filtered} />
            </div>
        </div>
    )
}
