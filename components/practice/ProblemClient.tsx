"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"
import { validateSubmission } from "@/actions/submissions"
import type { ValidationResult } from "@/lib/sql-validator"
import type { ProblemHistoryEntry } from "@/actions/submissions"
import { ProblemPanel } from "./ProblemPanel"

const SqlPlayground = dynamic(
    () =>
        import("@/components/sql/SqlPlayground").then((mod) => mod.SqlPlayground),
    { ssr: false }
)

interface ProblemClientProps {
    title: string
    slug: string
    difficulty: string
    description: string | null
    schemaDescription: string | null
    schemaSql: string | null
    hints: string[]
    expectedColumns: string[] | null
    expectedSampleRow: Record<string, unknown> | null
    initialHistory: ProblemHistoryEntry[]
    isSolved: boolean
}

const DRAFT_PREFIX = "dl:draft:"

export function ProblemClient({
    title,
    slug,
    difficulty,
    description,
    schemaDescription,
    schemaSql,
    hints,
    expectedColumns,
    expectedSampleRow,
    initialHistory,
    isSolved,
}: ProblemClientProps) {
    const [query, setQuery] = useState("")
    const [hydrated, setHydrated] = useState(false)
    const [history, setHistory] = useState(initialHistory)
    const [solved, setSolved] = useState(isSolved)
    const draftKey = `${DRAFT_PREFIX}${slug}`
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(draftKey)
            if (saved !== null) setQuery(saved)
        } catch {}
        setHydrated(true)
    }, [draftKey])

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
                    title={title}
                    difficulty={difficulty}
                    description={description}
                    schemaDescription={schemaDescription}
                    schemaSql={schemaSql}
                    hints={hints}
                    expectedColumns={expectedColumns}
                    expectedSampleRow={expectedSampleRow}
                    history={history}
                    isSolved={solved}
                    onLoadCode={loadCode}
                />
            </aside>
            <section className="flex-1 min-h-0 p-3 sm:p-4 bg-background">
                <SqlPlayground
                    initialSchema={schemaSql ?? undefined}
                    problemSlug={slug}
                    query={query}
                    onQueryChange={setQuery}
                    onSubmit={handleSubmit}
                    onReset={resetDraft}
                />
            </section>
        </div>
    )
}
