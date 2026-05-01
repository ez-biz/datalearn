"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { validateSubmission } from "@/actions/submissions"
import type { ValidationResult } from "@/lib/sql-validator"
import type { ProblemHistoryEntry } from "@/actions/submissions"
import { ProblemPanel, type TableInfo } from "./ProblemPanel"
import {
    extractTableNames,
    useProblemDB,
    type Dialect,
} from "@/lib/use-problem-db"
import { SqlPlaygroundSkeleton } from "@/components/sql/SqlPlaygroundSkeleton"

const SqlPlayground = dynamic(
    () =>
        import("@/components/sql/SqlPlayground").then((mod) => mod.SqlPlayground),
    { ssr: false, loading: () => <SqlPlaygroundSkeleton /> }
)

interface ProblemClientProps {
    number: number
    title: string
    slug: string
    difficulty: string
    description: string | null
    schemaDescription: string | null
    schemaSql: string | null
    hints: string[]
    /** Engines this problem can be solved in. Order doesn't matter. */
    dialects: Dialect[]
    expectedRows: Record<string, unknown>[] | null
    expectedColumns: string[] | null
    initialHistory: ProblemHistoryEntry[]
    isSolved: boolean
    /**
     * Pre-computed table info from the server-side schema parser. When
     * present, the Schema tab + INPUT example previews render at first
     * paint with no DuckDB dependency. When `null`, the parser couldn't
     * recognize the schema shape and we fall back to running DESCRIBE +
     * SELECT against DuckDB once `dbReady`.
     */
    initialTableInfos: TableInfo[] | null
    relatedArticles: Array<{
        id: string
        slug: string
        title: string
        summary: string | null
        readingMinutes: number | null
        topic: { slug: string }
    }>
}

const DRAFT_PREFIX = "dl:draft:"
const SAMPLE_LIMIT = 5

export function ProblemClient({
    number,
    title,
    slug,
    difficulty,
    description,
    schemaDescription,
    schemaSql,
    hints,
    dialects,
    expectedRows,
    expectedColumns,
    initialHistory,
    isSolved,
    initialTableInfos,
    relatedArticles,
}: ProblemClientProps) {
    const [query, setQuery] = useState("")
    const [hydrated, setHydrated] = useState(false)
    const [history, setHistory] = useState(initialHistory)
    const [solved, setSolved] = useState(isSolved)
    const [tableInfos, setTableInfos] = useState<TableInfo[] | null>(
        initialTableInfos
    )
    const draftKey = `${DRAFT_PREFIX}${slug}`
    const dialectKey = `dl:dialect:${slug}`
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Pick a starting dialect: localStorage choice if it's still
    // allowed for this problem; otherwise the first allowed one.
    const allowedDialects: Dialect[] =
        dialects.length > 0 ? dialects : ["DUCKDB"]
    const [dialect, setDialect] = useState<Dialect>(allowedDialects[0])

    useEffect(() => {
        try {
            const saved = localStorage.getItem(dialectKey) as Dialect | null
            if (saved && allowedDialects.includes(saved)) {
                setDialect(saved)
            }
        } catch {}
        // allowedDialects is derived from a stable prop; safe to omit.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialectKey])

    const handleDialectChange = useCallback(
        (d: Dialect) => {
            setDialect(d)
            try {
                localStorage.setItem(dialectKey, d)
            } catch {}
        },
        [dialectKey]
    )

    const { ready: dbReady, error: dbError, runQuery } = useProblemDB(
        schemaSql,
        dialect
    )

    // Hydrate draft from localStorage
    useEffect(() => {
        try {
            const saved = localStorage.getItem(draftKey)
            if (saved !== null) setQuery(saved)
        } catch {}
        setHydrated(true)
    }, [draftKey])

    // Debounced autosave
    useEffect(() => {
        if (!hydrated) return
        if (saveTimer.current) clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
            try {
                if (query.trim().length === 0) {
                    localStorage.removeItem(draftKey)
                } else {
                    localStorage.setItem(draftKey, query)
                }
            } catch {}
        }, 400)
        return () => {
            if (saveTimer.current) clearTimeout(saveTimer.current)
        }
    }, [query, hydrated, draftKey])

    // Once the DB is ready, fetch table schemas + samples for the description
    // tab — but only when the server-side parser couldn't pre-compute them.
    // (When `initialTableInfos` was provided, `tableInfos` is already populated
    // and there's nothing to fetch.)
    useEffect(() => {
        if (!dbReady) return
        if (tableInfos !== null) return
        let cancelled = false

        async function loadTables() {
            const names = extractTableNames(schemaSql)
            if (names.length === 0) {
                if (!cancelled) setTableInfos([])
                return
            }
            const infos: TableInfo[] = []
            for (const name of names) {
                try {
                    let columns: TableInfo["columns"]
                    if (dialect === "POSTGRES") {
                        const desc = await runQuery(
                            `SELECT column_name, data_type
                             FROM information_schema.columns
                             WHERE table_name = '${name}'
                               AND table_schema = current_schema()
                             ORDER BY ordinal_position`
                        )
                        columns = desc.map((row) => ({
                            name: String(row.column_name ?? ""),
                            type: String(row.data_type ?? ""),
                        }))
                    } else {
                        const desc = await runQuery(`DESCRIBE "${name}"`)
                        columns = desc.map((row) => ({
                            name: String(row.column_name ?? ""),
                            type: String(row.column_type ?? ""),
                        }))
                    }
                    const sample = await runQuery(
                        `SELECT * FROM "${name}" LIMIT ${SAMPLE_LIMIT}`
                    )
                    infos.push({ name, columns, sampleRows: sample })
                } catch (e: any) {
                    console.error(`Sample fetch failed for ${name}:`, e?.message)
                    infos.push({ name, columns: [], sampleRows: [] })
                }
            }
            if (!cancelled) setTableInfos(infos)
        }
        loadTables()
        return () => {
            cancelled = true
        }
    }, [dbReady, schemaSql, runQuery, tableInfos, dialect])

    const resetDraft = useCallback(() => {
        setQuery("")
        try {
            localStorage.removeItem(draftKey)
        } catch {}
    }, [draftKey])

    const loadCode = useCallback((code: string) => {
        setQuery(code)
    }, [])

    const handleSubmit = useCallback(
        async (userResult: unknown[]): Promise<ValidationResult> => {
            const outcome = await validateSubmission({
                problemSlug: slug,
                userResult,
                code: query,
            })
            if (outcome.ok) setSolved(true)
            setHistory((prev) => [
                {
                    id: `local-${Date.now()}`,
                    status: outcome.ok ? "ACCEPTED" : "WRONG_ANSWER",
                    code: query,
                    reason: outcome.ok ? null : outcome.reason ?? null,
                    createdAt: new Date(),
                },
                ...prev,
            ])
            return outcome
        },
        [slug, query]
    )

    return (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
            <aside className="w-full lg:w-2/5 xl:w-1/3 border-b lg:border-b-0 lg:border-r border-border min-h-[40vh] lg:min-h-0">
                <ProblemPanel
                    number={number}
                    title={title}
                    difficulty={difficulty}
                    description={description}
                    schemaDescription={schemaDescription}
                    schemaSql={schemaSql}
                    hints={hints}
                    tableInfos={tableInfos}
                    tablesLoading={dbReady && tableInfos === null}
                    expectedRows={expectedRows}
                    expectedColumns={expectedColumns}
                    history={history}
                    isSolved={solved}
                    relatedArticles={relatedArticles}
                    onLoadCode={loadCode}
                />
            </aside>
            <section className="flex-1 min-h-0 p-3 sm:p-4 bg-background">
                <SqlPlayground
                    dbReady={dbReady}
                    dbError={dbError}
                    runQuery={runQuery}
                    initialSchema={schemaSql ?? undefined}
                    problemSlug={slug}
                    query={query}
                    onQueryChange={setQuery}
                    onSubmit={handleSubmit}
                    onReset={resetDraft}
                    dialect={dialect}
                    allowedDialects={allowedDialects}
                    onDialectChange={handleDialectChange}
                />
            </section>
        </div>
    )
}
