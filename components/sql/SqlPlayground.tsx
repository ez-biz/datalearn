"use client"

import { useEffect, useRef, useState } from "react"
import { SqlEditor } from "./SqlEditor"
import { ResultTable } from "./ResultTable"
import { ValidationResult as ValidationResultView } from "./ValidationResult"
import { initDuckDB } from "@/lib/duckdb"
import { AsyncDuckDB } from "@duckdb/duckdb-wasm"
import type { ValidationResult } from "@/lib/sql-validator"

const DEFAULT_QUERY = "SELECT * FROM users LIMIT 10;"

interface SqlPlaygroundProps {
    initialSchema?: string
    initialQuery?: string
    problemSlug?: string
    onSubmit?: (userResult: unknown[]) => Promise<ValidationResult>
}

export function SqlPlayground({
    initialSchema,
    initialQuery,
    problemSlug,
    onSubmit,
}: SqlPlaygroundProps) {
    const defaultQuery =
        initialQuery ||
        (initialSchema
            ? "-- Write your SQL query here.\n-- Inspect the schema panel on the left for available tables."
            : DEFAULT_QUERY)
    const [query, setQuery] = useState(defaultQuery)
    const [results, setResults] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const [hasRunOnce, setHasRunOnce] = useState(false)
    const [validation, setValidation] = useState<ValidationResult | null>(null)

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
                        console.error(
                            "Statement failed:",
                            stmt.substring(0, 80),
                            stmtError.message
                        )
                        throw stmtError
                    }
                }

                setInitializing(false)
            } catch (e) {
                console.error("Failed to init DuckDB", e)
                setError("Failed to initialize database engine.")
                setInitializing(false)
            }
        }

        loadDB()
    }, [])

    async function runQuery(): Promise<any[] | null> {
        if (!connRef.current) return null
        const arrowTable = await connRef.current.query(query)
        const resultJson = arrowTable
            .toArray()
            .map((row: any) => row.toJSON())
        return resultJson
    }

    const handleRun = async () => {
        setLoading(true)
        setError(null)
        setResults([])
        setValidation(null)
        try {
            const resultJson = await runQuery()
            if (resultJson) {
                setResults(resultJson)
                setHasRunOnce(true)
            }
        } catch (e: any) {
            setError(e.message || "An error occurred executing the query")
        } finally {
            setLoading(false)
        }
    }

    const handleSubmit = async () => {
        if (!onSubmit || !problemSlug) return
        setSubmitting(true)
        setValidation(null)
        setError(null)
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
        } catch (e: any) {
            setError(e.message || "Submission failed.")
        } finally {
            setSubmitting(false)
        }
    }

    if (initializing) {
        return (
            <div className="p-8 text-center">
                Initializing SQL Engine... (Downloading WASM)
            </div>
        )
    }

    const showSubmit = Boolean(onSubmit && problemSlug)

    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-col lg:flex-row h-[600px] gap-4">
                <div className="w-full lg:w-1/2">
                    <SqlEditor
                        value={query}
                        onChange={(v) => setQuery(v || "")}
                        onRun={handleRun}
                    />
                </div>
                <div className="w-full lg:w-1/2">
                    <ResultTable data={results} error={error} loading={loading} />
                </div>
            </div>
            {showSubmit && (
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !hasRunOnce}
                        className="rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {submitting ? "Checking…" : "Submit"}
                    </button>
                    {!hasRunOnce && (
                        <span className="text-xs text-gray-500">
                            Run your query once to enable Submit.
                        </span>
                    )}
                </div>
            )}
            <ValidationResultView result={validation} />
        </div>
    )
}
