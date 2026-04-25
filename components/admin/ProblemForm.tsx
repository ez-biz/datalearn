"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Play, Save } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { HintsEditor } from "./HintsEditor"
import { TagPicker } from "./TagPicker"
import { useProblemDB } from "@/lib/use-problem-db"
import { slugify } from "@/lib/admin-validation"

type Difficulty = "EASY" | "MEDIUM" | "HARD"

interface SchemaOption {
    id: string
    name: string
    sql: string
}

export interface ProblemFormInitial {
    mode: "create" | "edit"
    title: string
    slug: string
    difficulty: Difficulty
    description: string
    schemaDescription: string
    ordered: boolean
    hints: string[]
    tagSlugs: string[]
    schemaId?: string
    expectedOutput: string
    solutionSql: string
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
    const [description, setDescription] = useState(initial.description)
    const [schemaDescription, setSchemaDescription] = useState(
        initial.schemaDescription
    )
    const [ordered, setOrdered] = useState(initial.ordered)
    const [hints, setHints] = useState(initial.hints)
    const [tagSlugs, setTagSlugs] = useState(initial.tagSlugs)
    const [solutionSql, setSolutionSql] = useState(initial.solutionSql)
    const [expectedOutput, setExpectedOutput] = useState(initial.expectedOutput)

    const [schemaMode, setSchemaMode] = useState<"existing" | "inline">(
        initial.schemaId ? "existing" : "inline"
    )
    const [schemaId, setSchemaId] = useState<string>(initial.schemaId ?? "")
    const [inlineSchemaName, setInlineSchemaName] = useState("")
    const [inlineSchemaSql, setInlineSchemaSql] = useState("")

    const [schemas, setSchemas] = useState<SchemaOption[]>([])
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

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
    const { ready: dbReady, error: dbError, runQuery } = useProblemDB(dbInput)
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
            const payload: Record<string, unknown> = {
                title,
                slug,
                difficulty,
                description,
                schemaDescription,
                ordered,
                hints: hints.filter((h) => h.trim().length > 0),
                tagSlugs,
                expectedOutput,
                solutionSql: solutionSql.length > 0 ? solutionSql : null,
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
            router.push(`/admin/problems/${newSlug}/edit`)
            router.refresh()
        } catch (e: any) {
            setError(e?.message ?? "Failed to save.")
        } finally {
            setSubmitting(false)
        }
    }

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
                    <div className="grid sm:grid-cols-2 gap-4">
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
                                    Order matters (use for ORDER BY problems)
                                </span>
                            </label>
                        </Field>
                    </div>
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
                        Write the canonical solution. Hit{" "}
                        <span className="font-medium text-foreground">Run & capture</span>{" "}
                        to execute it against the schema in your browser and store the
                        output as JSON below.
                    </div>
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
                        description="Auto-filled by Run & capture. You can also paste/edit manually."
                        required
                    >
                        <Textarea
                            id="expectedOutput"
                            value={expectedOutput}
                            onChange={(e) => setExpectedOutput(e.target.value)}
                            rows={10}
                            placeholder='[{"name":"Alice","total":1234.5}]'
                            required
                        />
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
