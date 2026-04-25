"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, Loader2, Play, Send } from "lucide-react"
import { SqlEditor } from "./SqlEditor"
import { ResultTable } from "./ResultTable"
import { ValidationResult as ValidationResultView } from "./ValidationResult"
import { initDuckDB } from "@/lib/duckdb"
import { AsyncDuckDB } from "@duckdb/duckdb-wasm"
import type { ValidationResult } from "@/lib/sql-validator"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

const DEFAULT_QUERY = "-- Write your SQL query here.\n\nSELECT 1 AS hello;"

interface SqlPlaygroundProps {
    initialSchema?: string
    initialQuery?: string
    problemSlug?: string
    onSubmit?: (userResult: unknown[]) => Promise<ValidationResult>
}

type Tab = "results" | "verdict"

export function SqlPlayground({
    initialSchema,
    initialQuery,
    problemSlug,
    onSubmit,
}: SqlPlaygroundProps) {
    const defaultQuery =
        initialQuery ||
        (initialSchema
            ? "-- Write your SQL query here.\n-- Inspect the schema panel for available tables.\n"
            : DEFAULT_QUERY)
    const [query, setQuery] = useState(defaultQuery)
    const [results, setResults] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const [hasRunOnce, setHasRunOnce] = useState(false)
    const [validation, setValidation] = useState<ValidationResult | null>(null)
    const [tab, setTab] = useState<Tab>("results")
    const [elapsedMs, setElapsedMs] = useState<number | null>(null)

    const dbRef = useRef<AsyncDuckDB | null>(null)
    const connRef = useRef<any>(null)

    useEffect(() => {
        async function loadDB() {
            try {
                const db = await initDuckDB()
                dbRef.current = db
                const conn = await db.connect()
                connRef.current = conn

                const schema =
                    initialSchema ||
                    `
                    CREATE TABLE users (id INTEGER, name VARCHAR, role VARCHAR);
                    INSERT INTO users VALUES (1, 'Alice', 'Engineer');
                    INSERT INTO users VALUES (2, 'Bob', 'Data Scientist');
                    INSERT INTO users VALUES (3, 'Charlie', 'Manager');
                `
                const statements = schema
                    .split(/;\s*\n|;\s*$/)
                    .map((s) => s.trim())
                    .filter((s) => s.length > 0)

                for (const stmt of statements) {
                    try {
                        await conn.query(stmt)
                    } catch (stmtError: any) {
                        console.error("Statement failed:", stmt.substring(0, 80), stmtError.message)
                        throw stmtError
                    }
                }
                setInitializing(false)
            } catch (e) {
                console.error("Failed to init DuckDB", e)
                setError("Failed to initialize the SQL engine. Try refreshing the page.")
                setInitializing(false)
            }
        }
        loadDB()
    }, [initialSchema])

    async function runQuery(): Promise<any[] | null> {
        if (!connRef.current) return null
        const arrowTable = await connRef.current.query(query)
        return arrowTable.toArray().map((row: any) => row.toJSON())
    }

    const handleRun = async () => {
        setLoading(true)
        setError(null)
        setResults([])
        setValidation(null)
        setTab("results")
        const t0 = performance.now()
        try {
            const resultJson = await runQuery()
            if (resultJson) {
                setResults(resultJson)
                setHasRunOnce(true)
            }
        } catch (e: any) {
            setError(e.message || "An error occurred executing the query")
        } finally {
            setElapsedMs(Math.max(1, Math.round(performance.now() - t0)))
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!onSubmit || !problemSlug) return
        setSubmitting(true)
        setValidation(null)
        setError(null)
        const t0 = performance.now()
        try {
            const resultJson = await runQuery()
            if (!resultJson) {
                setError("Could not get query result for submission.")
                return
            }
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

    if (initializing) {
        return (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Initializing in-browser SQL engine…
            </div>
        )
    }

    const showSubmit = Boolean(onSubmit && problemSlug)
    const submitDisabled = submitting || loading || !hasRunOnce

    return (
        <div className="flex flex-col h-full gap-3">
            <div className="flex-1 min-h-0">
                <SqlEditor
                    value={query}
                    onChange={(v) => setQuery(v || "")}
                    onRun={handleRun}
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
                <div className="flex items-center gap-3">
                    {elapsedMs != null && !loading && !submitting && (
                        <span className="text-xs text-muted-foreground tabular-nums hidden sm:inline">
                            {elapsedMs} ms
                        </span>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRun}
                        disabled={loading || submitting}
                    >
                        <Play className="h-3.5 w-3.5" />
                        Run
                    </Button>
                    {showSubmit && (
                        <Button
                            size="sm"
                            onClick={handleSubmit}
                            disabled={submitDisabled}
                            title={!hasRunOnce ? "Run your query at least once before submitting." : undefined}
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
