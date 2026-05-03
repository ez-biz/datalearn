"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Play, Save } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { HintsEditor } from "./HintsEditor"
import { TagPicker } from "./TagPicker"
import { useProblemDB } from "@/lib/use-problem-db"
import { slugify } from "@/lib/admin-validation"

type Difficulty = "EASY" | "MEDIUM" | "HARD"
type ProblemStatus = "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"

interface SchemaOption {
    id: string
    name: string
    sql: string
}

type Dialect = "DUCKDB" | "POSTGRES"

export interface ProblemFormInitial {
    mode: "create" | "edit"
    title: string
    slug: string
    difficulty: Difficulty
    status: ProblemStatus
    description: string
    schemaDescription: string
    ordered: boolean
    dialects: Dialect[]
    hints: string[]
    tagSlugs: string[]
    schemaId?: string
    /** v0.4.2+ per-dialect canonical solutions. */
    solutions: Record<string, string>
    /** v0.4.2+ per-dialect expectedOutput JSON strings. */
    expectedOutputs: Record<string, string>
    /** @deprecated v0.4.2 — fallback when `solutions` is empty. */
    expectedOutput: string
    /** @deprecated v0.4.2 — fallback when `expectedOutputs` is empty. */
    solutionSql: string
}

const DIALECT_LABELS: Record<Dialect, string> = {
    DUCKDB: "DuckDB",
    POSTGRES: "Postgres",
}

interface ProblemFormProps {
    initial: ProblemFormInitial
    /** For edit mode: the original slug used in the URL. */
    originalSlug?: string
}

export function ProblemForm({ initial, originalSlug }: ProblemFormProps) {
    const router = useRouter()
    const [title, setTitle] = useState(initial.title)
    const [slug, setSlug] = useState(initial.slug)
    const [slugTouched, setSlugTouched] = useState(initial.mode === "edit")
    const [difficulty, setDifficulty] = useState<Difficulty>(initial.difficulty)
    const [status, setStatus] = useState<ProblemStatus>(initial.status)
    const [description, setDescription] = useState(initial.description)
    const [schemaDescription, setSchemaDescription] = useState(
        initial.schemaDescription
    )
    const [ordered, setOrdered] = useState(initial.ordered)
    const initialDialects: Dialect[] =
        initial.dialects.length > 0 ? initial.dialects : ["DUCKDB", "POSTGRES"]
    const [dialects, setDialects] = useState<Dialect[]>(initialDialects)
    const [hints, setHints] = useState(initial.hints)
    const [tagSlugs, setTagSlugs] = useState(initial.tagSlugs)

    // v0.4.2+ per-dialect maps. Initialize from the new fields when
    // present, fall back to the legacy single fields (which seed every
    // listed dialect with the same value) so existing problems open
    // populated.
    const [solutions, setSolutions] = useState<Record<string, string>>(() => {
        const seed: Record<string, string> = { ...initial.solutions }
        for (const d of initialDialects) {
            if (!seed[d] && initial.solutionSql) seed[d] = initial.solutionSql
        }
        return seed
    })
    const [expectedOutputs, setExpectedOutputs] = useState<Record<string, string>>(
        () => {
            const seed: Record<string, string> = { ...initial.expectedOutputs }
            for (const d of initialDialects) {
                if (!seed[d] && initial.expectedOutput)
                    seed[d] = initial.expectedOutput
            }
            return seed
        }
    )
    const [activeDialect, setActiveDialect] = useState<Dialect>(
        initialDialects[0] ?? "DUCKDB"
    )

    // Convenience accessors for the active tab — keeps render code clean.
    const solutionSql = solutions[activeDialect] ?? ""
    const expectedOutput = expectedOutputs[activeDialect] ?? ""
    const setSolutionSql = (v: string) =>
        setSolutions((prev) => ({ ...prev, [activeDialect]: v }))
    const setExpectedOutput = (v: string) =>
        setExpectedOutputs((prev) => ({ ...prev, [activeDialect]: v }))

    /**
     * Industry practice (Codeforces, HackerRank, Codewars, etc.): expected
     * output is captured from running a reference solution, never hand-typed.
     * We lock the textarea by default and require an explicit opt-in to edit.
     */
    const [overrideExpected, setOverrideExpected] = useState(false)

    const [schemaMode, setSchemaMode] = useState<"existing" | "inline">(
        initial.schemaId ? "existing" : "inline"
    )
    const [schemaId, setSchemaId] = useState<string>(initial.schemaId ?? "")
    const [inlineSchemaName, setInlineSchemaName] = useState("")
    const [inlineSchemaSql, setInlineSchemaSql] = useState("")

    const [schemas, setSchemas] = useState<SchemaOption[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)

    // Auto-derive slug from title until the user manually edits the slug field
    useEffect(() => {
        if (!slugTouched) {
            setSlug(slugify(title))
        }
    }, [title, slugTouched])

    // Load existing schemas once
    useEffect(() => {
        ;(async () => {
            const res = await fetch("/api/admin/schemas")
            if (res.ok) {
                const json = await res.json()
                setSchemas(json.data ?? [])
            }
        })()
    }, [])

    // Determine the schema SQL to use for the in-browser DB (for the solution runner)
    const activeSchemaSql = useMemo(() => {
        if (schemaMode === "inline") return inlineSchemaSql
        const found = schemas.find((s) => s.id === schemaId)
        return found?.sql ?? ""
    }, [schemaMode, inlineSchemaSql, schemaId, schemas])

    const dbInput = activeSchemaSql.trim().length > 0 ? activeSchemaSql : null
    // Use the active dialect's engine for "Run & capture" so authors
    // capture the exact rows learners will see in that dialect.
    const { ready: dbReady, error: dbError, runQuery } = useProblemDB(
        dbInput,
        activeDialect
    )
    const [running, setRunning] = useState(false)
    const [runStatus, setRunStatus] = useState<string | null>(null)

    async function captureOutput() {
        setError(null)
        setRunStatus(null)
        if (!dbReady) {
            setRunStatus("Schema engine still warming up — try again in a moment.")
            return
        }
        if (!solutionSql.trim()) {
            setRunStatus("Add a solution SQL query first.")
            return
        }
        setRunning(true)
        try {
            const rows = await runQuery(solutionSql)
            // Convert BigInt to Number/string for JSON serialization
            const safe = rows.map((row) =>
                Object.fromEntries(
                    Object.entries(row).map(([k, v]) => [
                        k,
                        typeof v === "bigint"
                            ? Number.isSafeInteger(Number(v))
                                ? Number(v)
                                : v.toString()
                            : v,
                    ])
                )
            )
            const json = JSON.stringify(safe, null, 2)
            setExpectedOutput(json)
            setRunStatus(`Captured ${rows.length} row${rows.length === 1 ? "" : "s"}.`)
        } catch (e: any) {
            setRunStatus(`Error: ${e?.message ?? "query failed"}`)
        } finally {
            setRunning(false)
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            // Send only the entries for currently-listed dialects.
            // (Author may have toggled a dialect off after capturing
            // its solution; we don't ship orphaned slots.)
            const filteredSolutions: Record<string, string> = {}
            const filteredExpectedOutputs: Record<string, string> = {}
            for (const d of dialects) {
                if (solutions[d]) filteredSolutions[d] = solutions[d]
                if (expectedOutputs[d])
                    filteredExpectedOutputs[d] = expectedOutputs[d]
            }
            // Pick a representative legacy value for back-compat write.
            const firstDialect = dialects[0]
            const legacyExpected =
                (firstDialect && filteredExpectedOutputs[firstDialect]) || ""
            const legacySolution =
                (firstDialect && filteredSolutions[firstDialect]) || ""

            const payload: Record<string, unknown> = {
                title,
                slug,
                difficulty,
                status,
                description,
                schemaDescription,
                ordered,
                dialects,
                hints: hints.filter((h) => h.trim().length > 0),
                tagSlugs,
                solutions: filteredSolutions,
                expectedOutputs: filteredExpectedOutputs,
                // Legacy back-compat fields — server reads new shape first
                // but writes both columns until the cleanup release.
                expectedOutput: legacyExpected,
                solutionSql: legacySolution.length > 0 ? legacySolution : null,
            }
            if (schemaMode === "existing") {
                payload.schemaId = schemaId
            } else {
                payload.schemaInline = {
                    name: inlineSchemaName,
                    sql: inlineSchemaSql,
                }
            }

            const url =
                initial.mode === "create"
                    ? "/api/admin/problems"
                    : `/api/admin/problems/${originalSlug}`
            const method = initial.mode === "create" ? "POST" : "PATCH"

            // PATCH should not send schemaInline (only schemaId is supported on update)
            if (method === "PATCH") {
                delete payload.schemaInline
                if (schemaMode !== "existing") {
                    setError(
                        "Inline schema creation is only supported when creating a new problem. Pick an existing schema."
                    )
                    setSubmitting(false)
                    return
                }
            }

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Request failed: ${res.status}`)
                if (json.details) console.error("Validation details:", json.details)
                return
            }
            const newSlug = json?.data?.slug ?? slug
            // On create: redirect to the edit page so refreshes don't re-POST.
            // On edit: stay put, show an inline "Saved" indicator that auto-clears.
            if (initial.mode === "create") {
                router.push(`/admin/problems/${newSlug}/edit`)
                router.refresh()
            } else {
                if (newSlug !== originalSlug) {
                    // slug changed — URL must update
                    router.push(`/admin/problems/${newSlug}/edit`)
                }
                setSavedAt(Date.now())
                router.refresh()
            }
        } catch (e: any) {
            setError(e?.message ?? "Failed to save.")
        } finally {
            setSubmitting(false)
        }
    }

    // Auto-clear the "Saved" indicator after 3s
    useEffect(() => {
        if (savedAt == null) return
        const t = setTimeout(() => setSavedAt(null), 3000)
        return () => clearTimeout(t)
    }, [savedAt])

    return (
        <form onSubmit={onSubmit} className="space-y-6">
            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Basics</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Title" htmlFor="title" required>
                            <Input
                                id="title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Top customers by revenue"
                                required
                            />
                        </Field>
                        <Field label="Slug" htmlFor="slug" description="Lowercase, hyphenated. Used in the URL." required>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => {
                                    setSlug(e.target.value)
                                    setSlugTouched(true)
                                }}
                                placeholder="top-customers-by-revenue"
                                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                required
                            />
                        </Field>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-4">
                        <Field label="Difficulty" htmlFor="difficulty" required>
                            <select
                                id="difficulty"
                                value={difficulty}
                                onChange={(e) =>
                                    setDifficulty(e.target.value as Difficulty)
                                }
                                className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="EASY">Easy</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HARD">Hard</option>
                            </select>
                        </Field>
                        <Field
                            label="Status"
                            htmlFor="status"
                            description="DRAFT/BETA hide from users. PUBLISHED is live."
                            required
                        >
                            <select
                                id="status"
                                value={status}
                                onChange={(e) =>
                                    setStatus(e.target.value as ProblemStatus)
                                }
                                className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="DRAFT">Draft</option>
                                <option value="BETA">Beta (admin-only)</option>
                                <option value="PUBLISHED">Published</option>
                                <option value="ARCHIVED">Archived</option>
                            </select>
                        </Field>
                        <Field label="Ordered comparison" htmlFor="ordered" description="If checked, row order matters during validation.">
                            <label className="inline-flex items-center gap-2 h-10">
                                <input
                                    id="ordered"
                                    type="checkbox"
                                    checked={ordered}
                                    onChange={(e) => setOrdered(e.target.checked)}
                                    className="h-4 w-4"
                                />
                                <span className="text-sm">
                                    Order matters (ORDER BY)
                                </span>
                            </label>
                        </Field>
                    </div>
                    <Field
                        label="SQL engines"
                        htmlFor="dialect-duckdb"
                        description="Engines this problem can be solved in. Most are portable — narrow only when the canonical solution uses dialect-specific syntax (JSONB, STRING_AGG, LIST_AGG, etc.)."
                    >
                        <div className="flex flex-wrap gap-3">
                            {(["DUCKDB", "POSTGRES"] as const).map((d) => {
                                const checked = dialects.includes(d)
                                const isOnly = checked && dialects.length === 1
                                return (
                                    <label
                                        key={d}
                                        className="inline-flex items-center gap-2 h-10"
                                    >
                                        <input
                                            id={`dialect-${d.toLowerCase()}`}
                                            type="checkbox"
                                            checked={checked}
                                            disabled={isOnly}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setDialects((prev) =>
                                                        prev.includes(d)
                                                            ? prev
                                                            : [...prev, d]
                                                    )
                                                    // Auto-copy from the
                                                    // currently-populated
                                                    // dialect so the new tab
                                                    // opens with a starting
                                                    // point. Author can edit
                                                    // freely from there.
                                                    setSolutions((prev) => {
                                                        if (prev[d]) return prev
                                                        const source =
                                                            prev[activeDialect] ||
                                                            Object.values(prev).find(
                                                                (v) => Boolean(v)
                                                            )
                                                        return source
                                                            ? { ...prev, [d]: source }
                                                            : prev
                                                    })
                                                    setExpectedOutputs((prev) => {
                                                        if (prev[d]) return prev
                                                        const source =
                                                            prev[activeDialect] ||
                                                            Object.values(prev).find(
                                                                (v) => Boolean(v)
                                                            )
                                                        return source
                                                            ? { ...prev, [d]: source }
                                                            : prev
                                                    })
                                                } else {
                                                    setDialects((prev) =>
                                                        prev.filter((p) => p !== d)
                                                    )
                                                    // Don't delete data on
                                                    // toggle-off (mistakes
                                                    // happen). Only filter on
                                                    // submit. If the active
                                                    // tab was just removed,
                                                    // switch to a remaining
                                                    // dialect.
                                                    if (activeDialect === d) {
                                                        const remaining =
                                                            dialects.filter(
                                                                (p) => p !== d
                                                            )
                                                        if (remaining[0])
                                                            setActiveDialect(
                                                                remaining[0]
                                                            )
                                                    }
                                                }
                                            }}
                                            className="h-4 w-4"
                                        />
                                        <span className="text-sm">
                                            {d === "DUCKDB"
                                                ? "DuckDB"
                                                : "Postgres"}
                                        </span>
                                    </label>
                                )
                            })}
                        </div>
                    </Field>
                    <Field label="Description" htmlFor="description" description="What the user has to do. Plain text." required>
                        <Textarea
                            id="description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={5}
                            placeholder="Return every customer whose country is USA…"
                            className="font-sans"
                            required
                        />
                    </Field>
                    <Field
                        label="Schema description (optional)"
                        htmlFor="schemaDescription"
                        description="Short prose about the dataset. Shown when no input tables are detected."
                    >
                        <Textarea
                            id="schemaDescription"
                            value={schemaDescription}
                            onChange={(e) => setSchemaDescription(e.target.value)}
                            rows={2}
                            className="font-sans"
                        />
                    </Field>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Schema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 w-fit">
                        <ToggleBtn
                            active={schemaMode === "existing"}
                            onClick={() => setSchemaMode("existing")}
                        >
                            Use existing
                        </ToggleBtn>
                        <ToggleBtn
                            active={schemaMode === "inline"}
                            onClick={() => setSchemaMode("inline")}
                            disabled={initial.mode === "edit"}
                            title={
                                initial.mode === "edit"
                                    ? "Inline-create only available for new problems."
                                    : undefined
                            }
                        >
                            Create new
                        </ToggleBtn>
                    </div>

                    {schemaMode === "existing" ? (
                        <Field label="Schema" htmlFor="schemaId" required>
                            <select
                                id="schemaId"
                                value={schemaId}
                                onChange={(e) => setSchemaId(e.target.value)}
                                className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                required
                            >
                                <option value="">— Select schema —</option>
                                {schemas.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    ) : (
                        <div className="space-y-4">
                            <Field label="Schema name" htmlFor="inlineName" required>
                                <Input
                                    id="inlineName"
                                    value={inlineSchemaName}
                                    onChange={(e) => setInlineSchemaName(e.target.value)}
                                    placeholder="ecommerce"
                                    required={schemaMode === "inline"}
                                />
                            </Field>
                            <Field
                                label="DDL + seed data"
                                htmlFor="inlineSql"
                                description="CREATE TABLE statements followed by INSERT statements. Each statement separated by semicolons."
                                required
                            >
                                <Textarea
                                    id="inlineSql"
                                    value={inlineSchemaSql}
                                    onChange={(e) => setInlineSchemaSql(e.target.value)}
                                    rows={12}
                                    placeholder={"CREATE TABLE customers (\n  customer_id INTEGER PRIMARY KEY,\n  name VARCHAR\n);\nINSERT INTO customers VALUES (1, 'Alice');\n"}
                                    required={schemaMode === "inline"}
                                />
                            </Field>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Solution & expected output</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                        Write the canonical solution per dialect. Most problems are portable —
                        type once, click <span className="font-medium text-foreground">Copy from {DIALECT_LABELS[activeDialect === "DUCKDB" ? "POSTGRES" : "DUCKDB"]}</span>{" "}
                        on the other tab if you want the same SQL there. Hit{" "}
                        <span className="font-medium text-foreground">Run & capture</span>{" "}
                        to execute against the active dialect&apos;s engine and capture
                        its expected output as JSON.
                    </div>

                    {/* Per-dialect tab strip. Tabs only appear when multiple
                        dialects are selected; otherwise it's just a static
                        label so the active engine is always clear. */}
                    {dialects.length > 1 ? (
                        <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                            {dialects.map((d) => {
                                const active = d === activeDialect
                                const hasSolution = Boolean(solutions[d]?.trim())
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() => setActiveDialect(d)}
                                        className={[
                                            "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                            active
                                                ? "bg-surface-muted text-foreground"
                                                : "text-muted-foreground hover:text-foreground",
                                        ].join(" ")}
                                    >
                                        {DIALECT_LABELS[d]}
                                        {hasSolution && (
                                            <span
                                                title="Has solution"
                                                className="h-1.5 w-1.5 rounded-full bg-easy"
                                            />
                                        )}
                                    </button>
                                )
                            })}
                            {dialects.length === 2 && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const other =
                                            activeDialect === "DUCKDB"
                                                ? "POSTGRES"
                                                : "DUCKDB"
                                        if (solutions[other]) {
                                            setSolutions((prev) => ({
                                                ...prev,
                                                [activeDialect]: solutions[other],
                                            }))
                                        }
                                        if (expectedOutputs[other]) {
                                            setExpectedOutputs((prev) => ({
                                                ...prev,
                                                [activeDialect]:
                                                    expectedOutputs[other],
                                            }))
                                        }
                                    }}
                                    disabled={
                                        !solutions[
                                            activeDialect === "DUCKDB"
                                                ? "POSTGRES"
                                                : "DUCKDB"
                                        ]
                                    }
                                    className="ml-2 inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    title={`Copy ${
                                        DIALECT_LABELS[
                                            activeDialect === "DUCKDB"
                                                ? "POSTGRES"
                                                : "DUCKDB"
                                        ]
                                    } solution + expected output into ${DIALECT_LABELS[activeDialect]}`}
                                >
                                    ← Copy from{" "}
                                    {
                                        DIALECT_LABELS[
                                            activeDialect === "DUCKDB"
                                                ? "POSTGRES"
                                                : "DUCKDB"
                                        ]
                                    }
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                            Editing for: {DIALECT_LABELS[activeDialect]} (only dialect)
                        </div>
                    )}
                    <Field label="Solution SQL" htmlFor="solution">
                        <Textarea
                            id="solution"
                            value={solutionSql}
                            onChange={(e) => setSolutionSql(e.target.value)}
                            rows={6}
                            placeholder="SELECT name, SUM(amount) AS total FROM …"
                        />
                    </Field>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={captureOutput}
                            disabled={running || !dbReady}
                        >
                            {running ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Play className="h-3.5 w-3.5" />
                            )}
                            Run & capture
                        </Button>
                        {dbError && (
                            <span className="text-xs text-destructive">{dbError}</span>
                        )}
                        {!dbError && !dbReady && activeSchemaSql && (
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Loading schema engine…
                            </span>
                        )}
                        {runStatus && (
                            <span
                                className={`text-xs ${
                                    runStatus.startsWith("Error")
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                }`}
                            >
                                {runStatus}
                            </span>
                        )}
                    </div>
                    <Field
                        label="Expected output (JSON array of rows)"
                        htmlFor="expectedOutput"
                        description="Captured automatically from Run & capture. Locked by default — manual edits are an escape hatch only."
                        required
                    >
                        <div className="space-y-2">
                            <Textarea
                                id="expectedOutput"
                                value={expectedOutput}
                                onChange={(e) => setExpectedOutput(e.target.value)}
                                rows={10}
                                placeholder='[{"name":"Alice","total":1234.5}]'
                                readOnly={!overrideExpected}
                                required
                                className={
                                    !overrideExpected
                                        ? "bg-surface-muted/40 cursor-not-allowed"
                                        : ""
                                }
                            />
                            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={overrideExpected}
                                    onChange={(e) => setOverrideExpected(e.target.checked)}
                                    className="h-3.5 w-3.5"
                                />
                                Override manually (advanced — prefer Run & capture)
                            </label>
                        </div>
                    </Field>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Hints</CardTitle>
                </CardHeader>
                <CardContent>
                    <HintsEditor value={hints} onChange={setHints} />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tags</CardTitle>
                </CardHeader>
                <CardContent>
                    <TagPicker value={tagSlugs} onChange={setTagSlugs} />
                </CardContent>
            </Card>

            <div className="flex items-center gap-3 sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/80 backdrop-blur border-t border-border">
                <Button type="submit" disabled={submitting}>
                    {submitting ? (
                        <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Saving…
                        </>
                    ) : (
                        <>
                            <Save className="h-3.5 w-3.5" />
                            {initial.mode === "create" ? "Create problem" : "Save changes"}
                        </>
                    )}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/admin/problems")}
                    disabled={submitting}
                >
                    Cancel
                </Button>
                {savedAt && (
                    <span
                        role="status"
                        aria-live="polite"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-easy"
                    >
                        <Check className="h-3.5 w-3.5" />
                        Saved
                    </span>
                )}
            </div>
        </form>
    )
}

function ToggleBtn({
    active,
    onClick,
    disabled,
    title,
    children,
}: {
    active: boolean
    onClick: () => void
    disabled?: boolean
    title?: string
    children: React.ReactNode
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            aria-pressed={active}
            className={`rounded-sm px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                    ? "bg-surface-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </button>
    )
}
