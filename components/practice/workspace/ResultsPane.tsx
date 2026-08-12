"use client"

import { CheckCircle2 } from "lucide-react"
import { ResultTable } from "@/components/sql/ResultTable"
import { ValidationResult as ValidationResultView } from "@/components/sql/ValidationResult"
import type { ValidationResult } from "@/lib/sql-validator"
import type { SqlQueryResult } from "@/lib/use-problem-db"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"
import { cn } from "@/lib/utils"

export type ResultsTab = "results" | "verdict" | "runs"

/** One local run. Never persisted, never sent to the server. */
export type RunEntry = {
    id: number
    sql: string
    rows: number
    ms: number
}

interface ResultsPaneProps {
    tab: ResultsTab
    onTabChange: (tab: ResultsTab) => void
    showVerdict: boolean
    queryResult: SqlQueryResult | null
    error: string | null
    loading: boolean
    dbRecovering: boolean
    validation: ValidationResult | null
    elapsedMs: number | null
    runs: RunEntry[]
    status: StatusPillStatus | null
}

/**
 * Results / Verdict / Runs.
 *
 * "Runs" is this session's local run history — query, row count, elapsed.
 * It is deliberately NOT the submission history, which lives in the problem
 * panel's Submissions tab and is server-recorded. The design shows a tab
 * named "History" in both places; two tabs with one name in one screen is a
 * bug in the handoff, so this one is named for what it actually holds.
 */
export function ResultsPane({
    tab,
    onTabChange,
    showVerdict,
    queryResult,
    error,
    loading,
    dbRecovering,
    validation,
    elapsedMs,
    runs,
    status,
}: ResultsPaneProps) {
    const results = queryResult?.rows ?? []
    const elapsedLabel =
        elapsedMs == null ? "—" : `${(elapsedMs / 1000).toFixed(2)}s`

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-surface">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
                <div className="flex min-w-0 items-center gap-1">
                    <PaneTab
                        active={tab === "results"}
                        onClick={() => onTabChange("results")}
                        label="Results"
                    />
                    {showVerdict && (
                        <PaneTab
                            active={tab === "verdict"}
                            onClick={() => onTabChange("verdict")}
                            label="Verdict"
                            indicator={
                                validation?.ok
                                    ? "ok"
                                    : validation
                                      ? "fail"
                                      : undefined
                            }
                        />
                    )}
                    <PaneTab
                        active={tab === "runs"}
                        onClick={() => onTabChange("runs")}
                        label="Runs"
                        count={runs.length || undefined}
                    />
                </div>
                <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                    <span className="hidden tabular-nums text-muted-foreground sm:inline">
                        {results.length.toLocaleString()} rows
                    </span>
                    <span className="hidden text-muted-foreground-dim sm:inline">
                        ·
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                        {elapsedLabel}
                    </span>
                    {status && <StatusPill status={status} />}
                </div>
            </div>

            {tab === "results" && (
                <div className="min-h-0 min-w-0 flex-1">
                    <ResultTable
                        data={results}
                        error={error}
                        loading={loading}
                        loadingLabel={
                            dbRecovering ? "Resetting SQL engine…" : undefined
                        }
                        rowCount={queryResult?.rowCount}
                        truncated={queryResult?.truncated}
                        cap={queryResult?.cap}
                    />
                </div>
            )}

            {tab === "verdict" && (
                <div className="scrollbar-thin min-h-0 flex-1 overflow-auto p-4">
                    {validation ? (
                        <ValidationResultView result={validation} />
                    ) : (
                        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                            <CheckCircle2
                                className="mb-2 h-6 w-6 opacity-40"
                                aria-hidden
                            />
                            <p className="text-sm">No submission yet</p>
                            <p className="mt-1 text-xs">
                                Run your query, then hit Submit to check your
                                answer.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {tab === "runs" && (
                <div className="scrollbar-thin min-h-0 flex-1 overflow-auto">
                    {runs.length === 0 ? (
                        <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                            <p className="text-sm">No runs yet</p>
                            <p className="mt-1 text-xs">
                                Runs from this session appear here. They are not
                                saved.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-border">
                            {runs.map((run) => (
                                <li key={run.id} className="px-3 py-2">
                                    <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-muted-foreground">
                                        <span className="tabular-nums">
                                            {run.rows.toLocaleString()} rows
                                        </span>
                                        <span className="tabular-nums">
                                            {run.ms} ms
                                        </span>
                                    </div>
                                    <pre className="mt-1 truncate font-mono text-[11.5px] text-foreground/80">
                                        {run.sql.trim().split("\n")[0]}
                                    </pre>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

function PaneTab({
    active,
    onClick,
    label,
    count,
    indicator,
}: {
    active: boolean
    onClick: () => void
    label: string
    count?: number
    indicator?: "ok" | "fail"
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11px] uppercase tracking-wider transition-colors duration-150",
                active
                    ? "bg-panel-active text-foreground"
                    : "text-muted-foreground hover:text-foreground"
            )}
        >
            {label}
            {count !== undefined && (
                <span className="tabular-nums text-muted-foreground">
                    {count}
                </span>
            )}
            {indicator && (
                <span
                    aria-hidden
                    className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        indicator === "ok" ? "bg-primary" : "bg-destructive"
                    )}
                />
            )}
        </button>
    )
}
