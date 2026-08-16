"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Search, X } from "lucide-react"
import type { Prisma, ProblemStatus } from "@prisma/client"
import { filterProblems, type ProblemStatusFilter } from "@/lib/admin/problems-filter"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { ScrollableTable } from "@/components/ui/ScrollableTable"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"
import { ProblemRowActions } from "@/components/admin/ProblemRowActions"

export type ProblemListRow = Prisma.SQLProblemGetPayload<{
    include: {
        schema: { select: { name: true } }
        tags: { select: { id: true; name: true; slug: true } }
        _count: { select: { submissions: true } }
    }
}>

const STATUS_OPTIONS: { value: ProblemStatusFilter; label: string }[] = [
    { value: "ALL", label: "All" },
    { value: "DRAFT", label: "Draft" },
    { value: "BETA", label: "Beta" },
    { value: "PUBLISHED", label: "Published" },
    { value: "ARCHIVED", label: "Archived" },
]

const STATUS_LABEL: Record<ProblemStatusFilter, string> = {
    ALL: "all",
    DRAFT: "draft",
    BETA: "beta",
    PUBLISHED: "published",
    ARCHIVED: "archived",
}

/**
 * `app/admin/problems/page.tsx` still runs the `findMany` and still handles
 * the "no problems in the database at all" empty state — this component
 * only owns what happens once at least one row exists: search + status
 * filtering, both local `useState` and deliberately not URL-synced, same
 * as SP4's practice catalog (`components/practice/catalog/CatalogClient.tsx`).
 * The table itself — columns, grid template, status pills — is carried over
 * unchanged from the pre-SP7 page; only the colour classes were already
 * Console tokens and stay that way.
 */
export function ProblemsListClient({ problems }: { problems: ProblemListRow[] }) {
    const [query, setQuery] = useState("")
    const [status, setStatus] = useState<ProblemStatusFilter>("ALL")

    const filtered = useMemo(
        () => filterProblems(problems, query, status),
        [problems, query, status]
    )

    const hasActiveFilter = query.trim() !== "" || status !== "ALL"

    function handleClear() {
        setQuery("")
        setStatus("ALL")
    }

    return (
        <div>
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-surface-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                    <Search
                        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <Input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search title or slug…"
                        aria-label="Search problems"
                        className="h-9 bg-surface pl-9 text-[13px]"
                    />
                </div>

                <div className="flex items-center gap-3">
                    <div
                        role="group"
                        aria-label="Filter by status"
                        className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1"
                    >
                        {STATUS_OPTIONS.map((opt) => {
                            const active = status === opt.value
                            return (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setStatus(opt.value)}
                                    aria-pressed={active}
                                    className={cn(
                                        "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                                        active
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                                    )}
                                >
                                    {opt.label}
                                </button>
                            )
                        })}
                    </div>
                    <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                        {filtered.length} of {problems.length}
                    </span>
                </div>
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    title="No problems match your filters"
                    description={
                        query.trim()
                            ? `No results for "${query.trim()}"${
                                  status !== "ALL" ? ` in ${STATUS_LABEL[status]}` : ""
                              }. Try a different search or clear your filters.`
                            : `No ${STATUS_LABEL[status]} problems. Clear the filter to see everything.`
                    }
                    action={
                        hasActiveFilter ? (
                            <Button variant="outline" size="sm" onClick={handleClear}>
                                <X className="h-4 w-4" />
                                Clear filters
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <ScrollableTable>
                    <Card className="min-w-[960px] overflow-hidden">
                        <div className="hidden md:grid grid-cols-[4.5rem_1fr_8rem_8rem_1fr_1fr_6rem_3rem] items-center gap-4 px-5 py-3 border-b border-border bg-surface-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                            <span>#</span>
                            <span>Title</span>
                            <span>Status</span>
                            <span>Difficulty</span>
                            <span>Schema</span>
                            <span>Tags</span>
                            <span className="text-right tabular-nums">Submissions</span>
                            <span><span className="sr-only">Actions</span></span>
                        </div>
                        <ul className="divide-y divide-border">
                            {filtered.map((p) => (
                                <li
                                    key={p.id}
                                    className="grid grid-cols-1 md:grid-cols-[4.5rem_1fr_8rem_8rem_1fr_1fr_6rem_3rem] items-center gap-4 px-5 py-3"
                                >
                                    <div className="hidden font-mono text-[11px] tabular-nums text-muted-foreground md:block">
                                        #{String(p.number).padStart(3, "0")}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <Link
                                                href={`/admin/problems/${p.slug}/edit`}
                                                className="font-medium hover:text-primary transition-colors truncate"
                                            >
                                                <span className="mr-1 font-mono text-[11px] font-normal tabular-nums text-muted-foreground md:hidden">
                                                    #{String(p.number).padStart(3, "0")}
                                                </span>
                                                {p.title}
                                            </Link>
                                        </div>
                                        <p className="text-xs text-muted-foreground font-mono truncate">
                                            /{p.slug}
                                        </p>
                                    </div>
                                    <StatusBadge status={p.status} />
                                    <div>
                                        <DifficultyBadge difficulty={p.difficulty} />
                                    </div>
                                    <div className="text-sm text-muted-foreground truncate">
                                        {p.schema.name}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {p.tags.length === 0 ? (
                                            <span className="text-xs text-muted-foreground italic">
                                                none
                                            </span>
                                        ) : (
                                            p.tags.slice(0, 3).map((t) => (
                                                <Badge key={t.id} variant="secondary">
                                                    {t.slug}
                                                </Badge>
                                            ))
                                        )}
                                        {p.tags.length > 3 && (
                                            <span className="text-xs text-muted-foreground self-center">
                                                +{p.tags.length - 3}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-muted-foreground tabular-nums text-right">
                                        {p._count.submissions}
                                    </div>
                                    <ProblemRowActions
                                        slug={p.slug}
                                        title={p.title}
                                    />
                                </li>
                            ))}
                        </ul>
                    </Card>
                </ScrollableTable>
            )}
        </div>
    )
}

function StatusBadge({ status }: { status: ProblemStatus }) {
    const map: Record<ProblemStatus, { pill: StatusPillStatus; label: string }> = {
        DRAFT: { pill: "draft", label: "draft" },
        BETA: { pill: "pending", label: "beta" },
        PUBLISHED: { pill: "accepted", label: "published" },
        ARCHIVED: { pill: "rejected", label: "archived" },
    }
    const { pill, label } = map[status]
    return <StatusPill status={pill} label={label} />
}
