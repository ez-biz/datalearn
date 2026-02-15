"use client"

import { useEffect, useRef, useState } from "react"
import { SqlEditor } from "./SqlEditor"
import { ResultTable } from "./ResultTable"
import { initDuckDB } from "@/lib/duckdb"
import { AsyncDuckDB } from "@duckdb/duckdb-wasm"

const INITIAL_QUERY = "SELECT * FROM users LIMIT 10;"

interface SqlPlaygroundProps {
    initialSchema?: string
}

export function SqlPlayground({ initialSchema }: SqlPlaygroundProps) {
    const [query, setQuery] = useState(INITIAL_QUERY)
    const [results, setResults] = useState<any[]>([])
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)

    // Use a ref to keep the DB instance alive across renders
    const dbRef = useRef<AsyncDuckDB | null>(null)
    const connRef = useRef<any>(null)

    useEffect(() => {
        async function loadDB() {
            try {
                const db = await initDuckDB()
                dbRef.current = db
                const conn = await db.connect()
                connRef.current = conn

                // Seed some data
                if (initialSchema) {
                    await conn.query(initialSchema)
                } else {
                    await conn.query(`
                        CREATE TABLE users (id INTEGER, name VARCHAR, role VARCHAR);
                        INSERT INTO users VALUES 
                        (1, 'Alice', 'Engineer'), 
                        (2, 'Bob', 'Data Scientist'),
                        (3, 'Charlie', 'Manager');
                    `)
                }

                setInitializing(false)
            } catch (e) {
                console.error("Failed to init DuckDB", e)
                setError("Failed to initialize database engine.")
                setInitializing(false)
            }
        }

        loadDB()

        return () => {
            // Cleanup if needed, though DuckDB cleanup is async and tricky in React strict mode
        }
    }, [])

    const handleRun = async () => {
        if (!connRef.current) return

        setLoading(true)
        setError(null)
        setResults([])

        try {
            // DuckDB returns an Apache Arrow Table
            const arrowTable = await connRef.current.query(query)
            // Convert Arrow Table to JSON
            const resultJson = arrowTable.toArray().map((row: any) => row.toJSON())
            setResults(resultJson)
        } catch (e: any) {
            setError(e.message || "An error occurred executing the query")
        } finally {
            setLoading(false)
        }
    }

    if (initializing) {
        return <div className="p-8 text-center">Initializing SQL Engine... (Downloading WASM)</div>
    }

    return (
        <div className="flex flex-col lg:flex-row h-[600px] gap-4">
            <div className="w-full lg:w-1/2">
                <SqlEditor
                    value={query}
                    onChange={(v) => setQuery(v || "")}
                    onRun={handleRun}
                />
            </div>
            <div className="w-full lg:w-1/2">
                <ResultTable
                    data={results}
                    error={error}
                    loading={loading}
                />
            </div>
        </div>
    )
}
