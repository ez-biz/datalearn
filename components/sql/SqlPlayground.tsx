"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, Play, RotateCcw, Send } from "lucide-react"
import { SqlEditor } from "./SqlEditor"
import { ResultTable } from "./ResultTable"
import { ValidationResult as ValidationResultView } from "./ValidationResult"
import type { ValidationResult } from "@/lib/sql-validator"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

const DEFAULT_QUERY = "-- Write your SQL query here.\n\nSELECT 1 AS hello;"

interface SqlPlaygroundProps {
    /**
     * Whether the shared in-browser DB has finished initializing the schema.
     * When false, the playground shows a loading state.
     */
    dbReady: boolean
    /** Init error from the shared DB, if any. */
    dbError: string | null
    /** Run a SQL string against the shared connection and return rows. */
    runQuery: (sql: string) => Promise<any[]>
    initialSchema?: string
    problemSlug?: string
    query?: string
    onQueryChange?: (query: string) => void
    onSubmit?: (userResult: unknown[]) => Promise<ValidationResult>
    onReset?: () => void
}

type Tab = "results" | "verdict"

export function SqlPlayground({
    dbReady,
    dbError,
    runQuery,
    initialSchema,
    problemSlug,
    query: queryProp,
    onQueryChange,
    onSubmit,
    onReset,
}: SqlPlaygroundProps) {
    const controlled = queryProp !== undefined
    const placeholder = initialSchema
        ? "-- Write your SQL query here.\n-- Inspect the schema panel for available tables.\n"
        : DEFAULT_QUERY
    const [internalQuery, setInternalQuery] = useState(placeholder)
    const query = controlled ? (queryProp || placeholder) : internalQuery
    const setQuery = (v: string) => {
        if (controlled) {
            onQueryChange?.(v)
        } else {
            setInternalQuery(v)
        }
    }

    const [results, setResults] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [hasRunOnce, setHasRunOnce] = useState(false)
    const [validation, setValidation] = useState<ValidationResult | null>(null)
    const [tab, setTab] = useState<Tab>("results")
    const [elapsedMs, setElapsedMs] = useState<number | null>(null)

    const queryRef = useRef(query)
    queryRef.current = query

    const handleRun = async () => {
        if (!dbReady || loading || submitting) return
        setLoading(true)
        setError(null)
        setResults([])
        setValidation(null)
        setTab("results")
        const t0 = performance.now()
        try {
            const resultJson = await runQuery(queryRef.current)
            setResults(resultJson)
            setHasRunOnce(true)
        } catch (e: any) {
            setError(e.message || "An error occurred executing the query")
        } finally {
            setElapsedMs(Math.max(1, Math.round(performance.now() - t0)))
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!onSubmit || !problemSlug) return
        if (!dbReady || loading || submitting) return
        setSubmitting(true)
        setValidation(null)
        setError(null)
        const t0 = performance.now()
        try {
            const resultJson = await runQuery(queryRef.current)
            setResults(resultJson)
            setHasRunOnce(true)
            const outcome = await onSubmit(resultJson)
            setValidation(outcome)
            setTab("verdict")
        } catch (e: any) {
            setError(e.message || "Submission failed.")
            setTab("results")
        } finally {
            setElapsedMs(Math.max(1, Math.round(performance.now() - t0)))
            setSubmitting(false)
        }
    }

    // Global keyboard shortcuts
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey
            if (!mod) return
            if (e.key === "Enter") {
                if (e.shiftKey) {
                    if (onSubmit && problemSlug) {
                        e.preventDefault()
                        handleSubmit()
                    }
                } else {
                    e.preventDefault()
                    handleRun()
                }
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onSubmit, problemSlug, loading, submitting, dbReady])

    if (dbError) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-destructive p-4 text-center">
                {dbError}
            </div>
        )
    }

    // The editor is always rendered — Monaco doesn't need DuckDB. Run /
    // Submit are gated below until `dbReady`, so the user can read the
    // problem and start typing immediately while the WASM downloads.
    const showSubmit = Boolean(onSubmit && problemSlug)
    const runDisabled = !dbReady || loading || submitting
    const submitDisabled = !dbReady || submitting || loading || !hasRunOnce
    const isMac =
        typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    const modKey = isMac ? "⌘" : "Ctrl"
    const runTitle = !dbReady
        ? "Engine loading… (you can keep typing)"
        : `Run (${modKey} ↵)`
    const submitTitle = !dbReady
        ? "Engine loading… (you can keep typing)"
        : !hasRunOnce
            ? "Run your query at least once before submitting."
            : `Submit (${modKey} ⇧ ↵)`

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="flex-1 min-h-0">
                <SqlEditor
                    value={query}
                    onChange={(v) => setQuery(v || "")}
                    onRun={handleRun}
                    onSubmit={showSubmit ? handleSubmit : undefined}
                    running={loading}
                />
            </div>

            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                    <TabButton
                        active={tab === "results"}
                        onClick={() => setTab("results")}
                        label="Results"
                        count={results.length || undefined}
                    />
                    {showSubmit && (
                        <TabButton
                            active={tab === "verdict"}
                            onClick={() => setTab("verdict")}
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
                </div>
                <div className="flex items-center gap-2">
                    {elapsedMs != null && !loading && !submitting && (
                        <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {elapsedMs} ms
                        </span>
                    )}
                    {onReset && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onReset}
                            disabled={loading || submitting}
                            title="Reset draft (clears editor and removes saved local draft)"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Reset</span>
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRun}
                        disabled={runDisabled}
                        title={runTitle}
                    >
                        {!dbReady ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span className="hidden sm:inline">Engine loading…</span>
                            </>
                        ) : (
                            <>
                                <Play className="h-3.5 w-3.5" />
                                Run
                            </>
                        )}
                    </Button>
                    {showSubmit && (
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={submitDisabled}
                            title={submitTitle}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Checking…
                                </>
                            ) : (
                                <>
                                    <Send className="h-3.5 w-3.5" />
                                    Submit
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>

            <div className="h-[34vh] min-h-[260px] rounded-lg border border-border overflow-hidden bg-surface">
                {tab === "results" ? (
                    <ResultTable data={results} error={error} loading={loading} />
                ) : (
                    <div className="h-full overflow-auto p-4 scrollbar-thin">
                        {validation ? (
                            <ValidationResultView result={validation} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                                <CheckCircle2 className="h-6 w-6 mb-2 opacity-40" />
                                <p className="text-sm">No submission yet</p>
                                <p className="text-xs mt-1">
                                    Run your query, then hit Submit to check your answer.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

function TabButton({
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
                "rounded-sm px-3 py-1.5 text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer",
                active
                    ? "bg-surface-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
            )}
        >
            {label}
            {count != null && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                    {count}
                </span>
            )}
            {indicator === "ok" && (
                <span className="h-1.5 w-1.5 rounded-full bg-easy" />
            )}
            {indicator === "fail" && (
                <span className="h-1.5 w-1.5 rounded-full bg-hard" />
            )}
        </button>
    )
}
