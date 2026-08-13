import Link from "next/link"
import { ChevronRight, Circle, CircleCheck, CircleDashed } from "lucide-react"
import { cn } from "@/lib/utils"
import { TagPill } from "@/components/ui/TagPill"
import { formatPassRate, PASS_RATE_TITLE } from "@/lib/workspace/pass-rate"
import type { CatalogProblem } from "@/lib/practice/catalog-read"

/** Mobile tag-pill cap — beyond this we trail off with "+N", same convention
 *  PracticeList used before this component replaced it. */
const MOBILE_TAG_LIMIT = 2

/**
 * Grid templates shared with `CatalogTable`'s header so columns never drift
 * out of alignment between the header row and the data rows. Each carries a
 * `min-w` wide enough for its fixed-width columns plus a readable minimum
 * for the `1fr` title column, so the row never compresses on a narrow
 * screen — it overflows instead, and the table's `overflow-x-auto`
 * container turns that into a horizontal scroll rather than clipped text.
 */
export const CATALOG_ROW_GRID = "min-w-[620px] grid-cols-[34px_62px_1fr_120px_90px_78px_20px]"
export const CATALOG_ROW_GRID_COMPACT = "min-w-[360px] grid-cols-[34px_62px_1fr_90px_20px]"

const DIFFICULTY_LABEL: Record<CatalogProblem["difficulty"], string> = {
    EASY: "Easy",
    MEDIUM: "Medium",
    HARD: "Hard",
}

const DIFFICULTY_CLASS: Record<CatalogProblem["difficulty"], string> = {
    EASY: "text-easy",
    MEDIUM: "text-medium",
    HARD: "text-hard",
}

/**
 * One row of the practice catalog — also reused by the module screen
 * (`compact`) for the "attached problems" list, so this is the one place a
 * problem's status/title/difficulty/pass-rate presentation is decided.
 *
 * Rendered as an ARIA `row` with `cell` children rather than a native
 * `<table>`, matching `ProblemsPanel`'s CSS-grid row convention elsewhere in
 * the app. A real `<table>` can't express the `1fr` column the design calls
 * for. The parent is expected to supply the `table`/`rowgroup` context —
 * `CatalogTable` does this for the full catalog.
 */
export function CatalogRow({
    problem,
    compact = false,
}: {
    problem: CatalogProblem
    /** Compact drops the company and pass-rate columns; used by the module screen. */
    compact?: boolean
}) {
    const passRate = formatPassRate(problem.acceptedCount, problem.attemptCount)
    const company = problem.companyTags[0]

    return (
        <div
            role="row"
            className={cn(
                "group relative grid items-center gap-3 px-4 py-2.5 transition-colors duration-150 hover:bg-panel-hover",
                compact ? CATALOG_ROW_GRID_COMPACT : CATALOG_ROW_GRID
            )}
        >
            <span role="cell" className="flex items-center justify-center">
                {problem.solved ? (
                    <CircleCheck
                        className="h-4 w-4 text-primary"
                        aria-label="Solved"
                    />
                ) : problem.attempted ? (
                    <CircleDashed
                        className="h-4 w-4 text-warning"
                        aria-label="Attempted"
                    />
                ) : (
                    <Circle
                        className="h-3.5 w-3.5 text-text-dim"
                        aria-label="Not attempted"
                    />
                )}
            </span>

            <span role="cell" className="font-mono text-[11px] tabular-nums text-text-dim">
                {problem.number}
            </span>

            <span role="cell" className="min-w-0">
                <Link
                    href={`/practice/${problem.slug}`}
                    className={cn(
                        "block truncate text-[14.5px] font-medium leading-tight before:absolute before:inset-0 before:content-[''] focus-visible:outline-none focus-visible:before:rounded-md focus-visible:before:ring-2 focus-visible:before:ring-primary/40",
                        problem.solved
                            ? "text-text-muted"
                            : "text-foreground group-hover:text-primary"
                    )}
                >
                    {problem.title}
                </Link>
                {problem.topicTags.length > 0 && (
                    <div className="relative z-10 mt-1.5 flex flex-wrap items-center gap-1">
                        <div className="hidden flex-wrap items-center gap-1 sm:flex">
                            {problem.topicTags.map((tag) => (
                                <TagPill
                                    key={tag.slug}
                                    slug={tag.slug}
                                    name={tag.name}
                                    kind="TOPIC"
                                    stopPropagation
                                />
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-1 sm:hidden">
                            {problem.topicTags.slice(0, MOBILE_TAG_LIMIT).map((tag) => (
                                <TagPill
                                    key={tag.slug}
                                    slug={tag.slug}
                                    name={tag.name}
                                    kind="TOPIC"
                                    stopPropagation
                                />
                            ))}
                            {problem.topicTags.length > MOBILE_TAG_LIMIT && (
                                <span className="text-[10px] tabular-nums text-text-dim">
                                    +{problem.topicTags.length - MOBILE_TAG_LIMIT}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </span>

            {!compact && (
                <span role="cell" className="truncate font-mono text-[11px] text-text-3">
                    {company?.name ?? ""}
                </span>
            )}

            <span
                role="cell"
                className={cn("font-mono text-[11px]", DIFFICULTY_CLASS[problem.difficulty])}
            >
                {DIFFICULTY_LABEL[problem.difficulty]}
            </span>

            {!compact && (
                <span
                    role="cell"
                    className="font-mono text-[11px] tabular-nums text-text-3"
                    title={passRate ? PASS_RATE_TITLE : undefined}
                >
                    {passRate ?? ""}
                </span>
            )}

            <span role="cell" className="flex items-center justify-center">
                <ChevronRight
                    className="h-3.5 w-3.5 text-text-dim transition-colors duration-150 group-hover:text-primary"
                    aria-hidden="true"
                />
            </span>
        </div>
    )
}
