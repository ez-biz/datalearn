"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { SqlEditor, type MonacoEditorInstance } from "@/components/sql/SqlEditor"
import type { ValidationResult } from "@/lib/sql-validator"
import {
    DEFAULT_DISPLAY_ROW_CAP,
    computeValidateRowCap,
    limitQueryResultForDisplay,
} from "@/lib/sql-engine/result-cap"
import type {
    Dialect,
    SqlQueryOptions,
    SqlQueryResult,
} from "@/lib/use-problem-db"
import type { StatusPillStatus } from "@/components/ui/StatusPill"
import type { CheckpointContext } from "@/lib/workspace/queries"
import { cn } from "@/lib/utils"
import { ActionBar } from "./ActionBar"
import { ResultsPane, type ResultsTab, type RunEntry } from "./ResultsPane"
import { SqlAccessoryRow } from "./SqlAccessoryRow"
import type { Segment } from "./MobileSegments"

const DEFAULT_QUERY = "-- Write your SQL query here.\n\nSELECT 1 AS hello;"
const MAX_RUNS = 10

interface EditorPaneProps {
    dbReady: boolean
    dbError: string | null
    dbRecovering?: boolean
    runQuery: (sql: string, options?: SqlQueryOptions) => Promise<SqlQueryResult>
    queryTimeoutMs?: number
    initialSchema?: string
    problemSlug?: string
    query?: string
    onQueryChange?: (query: string) => void
    onSubmit?: (userResult: unknown[]) => Promise<ValidationResult>
    submissionDisabledReason?: string
    onReset?: () => void
    validateRowCap?: number
    dialect?: Dialect
    allowedDialects?: Dialect[]
    onDialectChange?: (d: Dialect) => void
    checkpointContext?: CheckpointContext | null
    /**
     * Which of the mobile Problem/Code/Result segments is active. Ignored at
     * `lg` and above, where the code block (editor + action bar) and the
     * results block are both always visible, stacked exactly as before SP6.
     * Below `lg` it toggles which of the two blocks below is `hidden` —
     * never which is mounted, so Monaco's model and the in-flight/last
     * query result both survive switching segments.
     */
    activeSegment?: Segment
}

/**
 * Editor, action bar, results pane.
 *
 * Replaces components/sql/SqlPlayground.tsx: the run/submit state machine
 * stays here, the controls moved to ActionBar and the output to ResultsPane,
 * so no single file owns all three again.
 *
 * Below `lg` this renders two independently-toggled blocks — "code" (editor
 * + the mobile accessory row + action bar) and "result" (ResultsPane) — so
 * WorkspaceLayout's Problem/Code/Result segments can show exactly one of
 * them full-height. Both blocks stay mounted at every width; only their
 * `hidden` class changes. At `lg` and up both are always visible, stacked
 * in the same order as before this task — the desktop composition is
 * unchanged.
 *
 * min-w-0 on the root is load-bearing — this is a flex child, and without it
 * the column refuses to shrink below its content and clips the action bar.
 */
export function EditorPane({
    dbReady,
    dbError,
    dbRecovering = false,
    runQuery,
    queryTimeoutMs,
    initialSchema,
    problemSlug,
    query: queryProp,
    onQueryChange,
    onSubmit,
    submissionDisabledReason,
    onReset,
    validateRowCap,
    dialect = "DUCKDB",
    allowedDialects = ["DUCKDB"],
    onDialectChange,
    checkpointContext = null,
    activeSegment = "code",
}: EditorPaneProps) {
    const controlled = queryProp !== undefined
    const placeholder = initialSchema
        ? "-- Write your SQL solution here.\n-- Table schemas and sample data are in the Description tab.\n"
        : DEFAULT_QUERY
    const [internalQuery, setInternalQuery] = useState(placeholder)
    const query = controlled ? queryProp || placeholder : internalQuery
    const setQuery = (v: string) => {
        if (controlled) onQueryChange?.(v)
        else setInternalQuery(v)
    }

    const [queryResult, setQueryResult] = useState<SqlQueryResult | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [hasRunOnce, setHasRunOnce] = useState(false)
    const [validation, setValidation] = useState<ValidationResult | null>(null)
    const [tab, setTab] = useState<ResultsTab>("results")
    const [elapsedMs, setElapsedMs] = useState<number | null>(null)
    const [runs, setRuns] = useState<RunEntry[]>([])
    const runSeq = useRef(0)

    const queryRef = useRef(query)
    queryRef.current = query

    // Captured once Monaco mounts (SqlEditor's onMount), used by the mobile
    // accessory row to insert a token at the current cursor/selection.
    const monacoEditorRef = useRef<MonacoEditorInstance | null>(null)
    const insertAtCursor = useCallback((text: string) => {
        const editor = monacoEditorRef.current
        if (!editor) return
        const selection = editor.getSelection()
        if (!selection) return
        editor.executeEdits("sql-accessory-row", [
            { range: selection, text, forceMoveMarkers: true },
        ])
        editor.focus()
    }, [])

    const recordRun = (sql: string, rows: number, ms: number) => {
        runSeq.current += 1
        const entry: RunEntry = { id: runSeq.current, sql, rows, ms }
        setRuns((prev) => [entry, ...prev].slice(0, MAX_RUNS))
    }

    const handleRun = async () => {
        if (!dbReady || dbRecovering || loading || submitting) return
        setLoading(true)
        setError(null)
        setQueryResult(null)
        setValidation(null)
        setTab("results")
        const t0 = performance.now()
        try {
            const result = await runQuery(queryRef.current, {
                rowCap: DEFAULT_DISPLAY_ROW_CAP,
                timeoutMs: queryTimeoutMs,
            })
            setQueryResult(result)
            setHasRunOnce(true)
            recordRun(
                queryRef.current,
                result.rows.length,
                Math.max(1, Math.round(performance.now() - t0))
            )
        } catch (e: any) {
            setError(e.message || "An error occurred executing the query")
        } finally {
            setElapsedMs(Math.max(1, Math.round(performance.now() - t0)))
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!onSubmit || !problemSlug) return
        if (submissionDisabledReason) return
        if (!dbReady || dbRecovering || loading || submitting) return
        setSubmitting(true)
        setValidation(null)
        setError(null)
        const t0 = performance.now()
        try {
            const cap = validateRowCap ?? computeValidateRowCap(null)
            const result = await runQuery(queryRef.current, {
                rowCap: cap,
                timeoutMs: queryTimeoutMs,
            })
            setQueryResult(
                limitQueryResultForDisplay(result, DEFAULT_DISPLAY_ROW_CAP)
            )
            setHasRunOnce(true)
            if (result.truncated) {
                setValidation({
                    ok: false,
                    reason: `Result is too large — your query returned more than ${cap.toLocaleString()} rows. Narrow the query before submitting.`,
                })
                setTab("verdict")
                return
            }
            const outcome = await onSubmit(result.rows)
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

    // Global keyboard shortcuts. Monaco registers its own via SqlEditor;
    // these catch the case where focus is outside the editor.
    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            const mod = e.metaKey || e.ctrlKey
            if (!mod) return
            if (e.key === "Enter") {
                if (e.shiftKey) {
                    if (onSubmit && problemSlug && !submissionDisabledReason) {
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
    }, [
        onSubmit,
        problemSlug,
        loading,
        submitting,
        dbReady,
        dbRecovering,
        submissionDisabledReason,
    ])

    if (dbError) {
        return (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-destructive">
                {dbError}
            </div>
        )
    }

    // The editor always renders — Monaco does not need DuckDB. Run/Submit
    // stay gated until dbReady so the learner can start typing immediately
    // while the WASM downloads.
    const showSubmit = Boolean(onSubmit && problemSlug)
    const runDisabled = !dbReady || dbRecovering || loading || submitting
    const submitDisabled =
        Boolean(submissionDisabledReason) ||
        !dbReady ||
        dbRecovering ||
        submitting ||
        loading ||
        !hasRunOnce
    const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad/.test(navigator.platform)
    const modKey = isMac ? "⌘" : "Ctrl"
    const runTitle = !dbReady
        ? "Engine loading… (you can keep typing)"
        : dbRecovering
          ? "SQL engine is resetting…"
          : `Run (${modKey} ↵)`
    const submitTitle =
        submissionDisabledReason ??
        (!dbReady
            ? "Engine loading… (you can keep typing)"
            : dbRecovering
              ? "SQL engine is resetting…"
              : !hasRunOnce
                ? "Run your query at least once before submitting."
                : `Submit (${modKey} ⇧ ↵)`)
    const status: StatusPillStatus | null =
        loading || submitting || dbRecovering
            ? "pending"
            : error
              ? "rejected"
              : validation
                ? validation.ok
                    ? "accepted"
                    : "rejected"
                : hasRunOnce
                  ? "accepted"
                  : null

    return (
        <div className="flex h-full min-w-0 flex-col gap-3">
            {/* Code: editor + mobile accessory row + action bar. Below `lg`
                visible only on the "code" segment; at `lg`+ always visible,
                identical to the pre-SP6 layout. */}
            <div
                className={cn(
                    "min-h-0 min-w-0 flex-1 flex-col gap-3",
                    activeSegment === "code" ? "flex" : "hidden",
                    "lg:flex"
                )}
            >
                <div className="min-h-0 min-w-0 flex-1">
                    <SqlEditor
                        value={query}
                        onChange={(v) => setQuery(v || "")}
                        onRun={handleRun}
                        onSubmit={
                            showSubmit && !submissionDisabledReason
                                ? handleSubmit
                                : undefined
                        }
                        running={loading}
                        runDisabled={runDisabled}
                        dialect={dialect}
                        allowedDialects={allowedDialects}
                        onDialectChange={onDialectChange}
                        onEditorReady={(editor) => {
                            monacoEditorRef.current = editor
                        }}
                    />
                </div>

                <SqlAccessoryRow onInsert={insertAtCursor} className="lg:hidden" />

                <ActionBar
                    onRun={handleRun}
                    onSubmit={handleSubmit}
                    onReset={onReset}
                    showSubmit={showSubmit}
                    runDisabled={runDisabled}
                    submitDisabled={submitDisabled}
                    submitting={submitting}
                    loading={loading}
                    dbReady={dbReady}
                    runTitle={runTitle}
                    submitTitle={submitTitle}
                    modKey={modKey}
                    checkpointContext={checkpointContext}
                />
            </div>

            {/* Result: below `lg` visible only on the "result" segment, full
                height. At `lg`+ always visible at the fixed 34vh it has had
                since SP5. */}
            <div
                className={cn(
                    "min-h-0 min-w-0 flex-col",
                    activeSegment === "result" ? "flex flex-1" : "hidden",
                    // Reset grow/shrink/basis individually (rather than the
                    // `flex-none` shorthand) so `h-[34vh]` governs sizing
                    // exactly as it did before this task: a shorthand's
                    // flex-basis: 0 would win over an explicit height on a
                    // column flex item and collapse this pane at `lg`+.
                    "lg:flex lg:h-[34vh] lg:min-h-[260px] lg:grow-0 lg:shrink lg:basis-auto"
                )}
            >
                <ResultsPane
                    tab={tab}
                    onTabChange={setTab}
                    showVerdict={showSubmit}
                    queryResult={queryResult}
                    error={error}
                    loading={loading}
                    dbRecovering={dbRecovering}
                    validation={validation}
                    elapsedMs={elapsedMs}
                    runs={runs}
                    status={status}
                />
            </div>
        </div>
    )
}
