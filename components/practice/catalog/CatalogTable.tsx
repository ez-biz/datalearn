import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { EmptyState } from "@/components/ui/EmptyState"
import type { CatalogProblem } from "@/lib/practice/catalog-read"
import { CATALOG_ROW_GRID, CatalogRow } from "@/components/practice/catalog/CatalogRow"

/**
 * The catalog's table shell: a `panel-raised` header, `line-faint` row
 * rules, and the filtered rows — or an `EmptyState` when a filter combination
 * matches nothing. Purely presentational; `CatalogClient` owns what
 * `problems` contains.
 *
 * Built as an ARIA grid (`table` / `rowgroup` / `row` / `columnheader` /
 * `cell`) over CSS-grid `<div>`s rather than a native `<table>`, so the
 * header's `CATALOG_ROW_GRID` template — shared with `CatalogRow` — can use
 * the `1fr` title column a native table can't express.
 */
export function CatalogTable({ problems }: { problems: CatalogProblem[] }) {
    if (problems.length === 0) {
        return (
            <EmptyState
                icon={<Search className="h-5 w-5" />}
                title="No problems match your filters"
                description="Try clearing a filter or the search box."
            />
        )
    }

    return (
        <div
            role="table"
            aria-label="Practice problems"
            className="overflow-hidden rounded-lg border border-line-soft"
        >
            <div role="rowgroup">
                <div
                    role="row"
                    className={cn(
                        "grid items-center gap-3 bg-panel-raised px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-text-dim",
                        CATALOG_ROW_GRID
                    )}
                >
                    <span role="columnheader" className="sr-only">
                        Status
                    </span>
                    <span role="columnheader">#</span>
                    <span role="columnheader">Title</span>
                    <span role="columnheader">Company</span>
                    <span role="columnheader">Difficulty</span>
                    <span role="columnheader">Pass rate</span>
                    <span role="columnheader" className="sr-only">
                        Open
                    </span>
                </div>
            </div>
            <div role="rowgroup" className="divide-y divide-line-faint">
                {problems.map((problem) => (
                    <CatalogRow key={problem.slug} problem={problem} />
                ))}
            </div>
        </div>
    )
}
