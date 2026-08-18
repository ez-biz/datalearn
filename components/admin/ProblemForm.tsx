"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Play, Save } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { HintsEditor } from "./HintsEditor"
import { TagPicker } from "./TagPicker"
import { CurriculumPlacement, type CurriculumBinding } from "./problem-form/CurriculumPlacement"
import { FormTabStrip } from "./problem-form/FormTabStrip"
import { SegmentedControl } from "./problem-form/SegmentedControl"
import { ValidationChecklist, type ChecklistItem } from "./problem-form/ValidationChecklist"
import { useProblemDB } from "@/lib/use-problem-db"
import { slugify } from "@/lib/admin-validation"
import { cn } from "@/lib/utils"
import {
    FORM_TABS,
    firstErroredTab,
    tabsWithErrors,
    type FormTabId,
} from "@/lib/admin/form-tabs"

type Difficulty = "EASY" | "MEDIUM" | "HARD"
type ProblemStatus = "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"
type DiscussionMode = "OPEN" | "LOCKED" | "HIDDEN"

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
    discussionMode?: DiscussionMode
    /** v0.4.2+ per-dialect canonical solutions. */
    solutions: Record<string, string>
    /** v0.4.2+ per-dialect expectedOutput JSON strings. */
    expectedOutputs: Record<string, string>
    /** @deprecated v0.4.2 — fallback when `solutions` is empty. */
    expectedOutput: string
    /** @deprecated v0.4.2 — fallback when `expectedOutputs` is empty. */
    solutionSql: string
    /** Task 11 (SP7) — this problem's current `LessonCheckpoint`, if any.
     * `undefined`/absent in create mode (the problem doesn't exist yet, so
     * it can't be a checkpoint of anything). `null` in edit mode means
     * "exists but unbound." */
    curriculumBinding?: CurriculumBinding | null
}

const DIALECT_LABELS: Record<Dialect, string> = {
    DUCKDB: "DuckDB",
    POSTGRES: "Postgres",
}

/**
 * First path segment of every Zod issue reported by `z.treeifyError`,
 * mapped to its first human-readable message — the API routes'
 * validation-failure shape (`{ error, details }`, see
 * `app/api/admin/problems/route.ts` and `.../[slug]/route.ts`).
 * `treeifyError`'s top-level `properties` keys are already
 * first-path-segments (a nested issue on `schemaInline.name` lives at
 * `details.properties.schemaInline.properties.name`, not as a dotted
 * key) — exactly what `tabForField`/`tabsWithErrors` expect per their doc
 * comments in `lib/admin/form-tabs.ts`. A key can be present with no
 * message of its own (e.g. `schemaInline` when only a nested property
 * failed) — falls back to a generic string so the field still renders
 * *something* rather than an empty error paragraph.
 */
function fieldErrorsFromTreeifiedError(details: unknown): Record<string, string> {
    if (!details || typeof details !== "object") return {}
    const properties = (details as { properties?: unknown }).properties
    if (!properties || typeof properties !== "object") return {}
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(properties as Record<string, unknown>)) {
        const errors = (value as { errors?: unknown } | undefined)?.errors
        out[key] =
            Array.isArray(errors) && typeof errors[0] === "string" && errors[0]
                ? errors[0]
                : "Check this field."
    }
    return out
}

/**
 * The four errors both routes hand-throw OUTSIDE Zod — `SCHEMA_NOT_FOUND`,
 * `SLUG_TAKEN` (and the P2002 unique-constraint fallback, same message),
 * `TAGS_NOT_FOUND`, `PUBLISHED_DIALECT_MAP_INCOMPLETE` — return
 * `{ error }` or `{ error, missing }` with no `details` at all (see the
 * `catch` blocks in `app/api/admin/problems/route.ts` and
 * `.../[slug]/route.ts`). Without this, a save rejected for one of these
 * reasons falls back to nothing but the top banner: no tab marked, no
 * field marked — the exact failure this task exists to prevent, arriving
 * through a path `fieldErrorsFromTreeifiedError` never sees.
 *
 * `.../[slug]/route.ts`'s PATCH handler now also returns a stable `code`
 * for these four (plus `PROBLEM_NOT_FOUND`, which has no field to route to
 * and stays banner-only either way) — matched FIRST, below, so a copy edit
 * to the message text can't silently break routing. The text match stays
 * as a fallback for responses that carry no code:
 *   - the P2002 unique-slug fallback (both routes) — same wording as
 *     SLUG_TAKEN's hand-thrown branch, but no `code` field
 *   - `app/api/admin/problems/route.ts` (POST/create) — never adds `code`
 *     to any of its hand-thrown branches
 *   - every curriculum-sync error below (`CURRICULUM_ERROR_MESSAGES`) —
 *     `addCheckpoint`/`removeCheckpoint` (lib/admin-curriculum.ts) return
 *     `{ ok: false, status, error }` with no `code` field at all, so these
 *     stay text-matched with no code path to prefer
 */
const CURRICULUM_ERROR_MESSAGES = new Set([
    "curriculumLessonId does not match any lesson.",
    "Lesson not found.",
    "Problem not found.",
    "Checkpoint not found.",
    "That problem is already a checkpoint on this lesson.",
    "That problem is already a checkpoint on another lesson.",
    "The curriculum changed during the write — reload and retry.",
    "Failed to add checkpoint.",
    "Failed to remove checkpoint.",
])

function fieldErrorsFromKnownServerMessage(
    message: string | undefined,
    missing: unknown,
    code?: string
): Record<string, string> {
    if (!message) return {}
    if (
        code === "SCHEMA_NOT_FOUND" ||
        message === "schemaId does not match any SqlSchema."
    ) {
        return { schemaId: message }
    }
    if (
        code === "SLUG_TAKEN" ||
        message === "A problem with that slug already exists."
    ) {
        return { slug: message }
    }
    if (code === "TAGS_NOT_FOUND" || message.startsWith("Unknown tag slug(s): ")) {
        return { tagSlugs: message }
    }
    // Task 11 (SP7) — every message the curriculum-sync step in
    // app/api/admin/problems/[slug]/route.ts's PATCH handler can surface:
    // the route's own pre-check plus every non-ok result string
    // addCheckpoint/removeCheckpoint (lib/admin-curriculum.ts) can return.
    // All land on the same field/tab since this route's only caller of
    // those two functions is the curriculum-sync step. None of these carry
    // a `code` — see the doc comment above.
    if (CURRICULUM_ERROR_MESSAGES.has(message)) {
        return { curriculumLessonId: message }
    }
    if (
        code === "PUBLISHED_DIALECT_MAP_INCOMPLETE" ||
        message ===
            "PUBLISHED problems require non-empty solutions and expectedOutputs for every listed dialect."
    ) {
        // `missing` is e.g. ["solutions.DUCKDB", "expectedOutputs.POSTGRES"]
        // — see getMissingPublishedDialectMapEntries in lib/admin-validation.ts.
        // Attribute only to whichever of solutions/expectedOutputs actually
        // appear, so a problem missing only expectedOutputs doesn't also
        // flag a perfectly fine solution.
        const prefixes = new Set(
            (Array.isArray(missing) ? missing : [])
                .filter((entry): entry is string => typeof entry === "string")
                .map((entry) => entry.split(".")[0])
        )
        const out: Record<string, string> = {}
        if (prefixes.has("solutions")) {
            out.solutionSql = message
            out.solutions = message
        }
        if (prefixes.has("expectedOutputs")) {
            out.expectedOutput = message
            out.expectedOutputs = message
        }
        // Malformed/empty `missing` — still mark both solution fields
        // rather than dropping a real 400 down to a banner-only failure.
        if (Object.keys(out).length === 0) {
            out.solutionSql = message
            out.expectedOutput = message
        }
        return out
    }
    return {}
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
    const [discussionMode, setDiscussionMode] = useState<DiscussionMode>(
        initial.discussionMode ?? "OPEN"
    )
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
    // Task 11 (SP7) — the target lesson's article id, or "" for no lesson.
    // Folded into the PATCH payload as `curriculumLessonId` on save, same
    // as every other field here; see CurriculumPlacement's doc comment for
    // why the actual write lives server-side.
    const [curriculumLessonId, setCurriculumLessonId] = useState(
        initial.curriculumBinding?.lessonId ?? ""
    )

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

    // Tracks the outcome of the last "Run & capture" click per dialect —
    // feeds the validation checklist's "solution runs clean" row. Cleared
    // for a dialect whenever its solution text changes, so a stale
    // "clean" never survives an edit that hasn't been re-run.
    const [runResults, setRunResults] = useState<
        Partial<Record<Dialect, "clean" | "error">>
    >({})

    // Convenience accessors for the active tab — keeps render code clean.
    const solutionSql = solutions[activeDialect] ?? ""
    const expectedOutput = expectedOutputs[activeDialect] ?? ""
    const setSolutionSql = (v: string) => {
        setSolutions((prev) => ({ ...prev, [activeDialect]: v }))
        setRunResults((prev) => {
            if (!(activeDialect in prev)) return prev
            const next = { ...prev }
            delete next[activeDialect]
            return next
        })
    }
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

    // Tab strip state — Task 10. `lib/admin/form-tabs.ts` is authoritative
    // for which tab owns which field; this component only tracks which
    // tab is active and, keyed by field name, the message the last save
    // attempt reported for it (drives both the tab-level marker via
    // `tabsWithErrors` and the per-field `<Field error=…>` text below).
    const [activeTab, setActiveTab] = useState<FormTabId>(FORM_TABS[0].id)
    const [erroredFieldMessages, setErroredFieldMessages] = useState<Record<string, string>>({})
    const erroredTabs = useMemo(
        () => tabsWithErrors(Object.keys(erroredFieldMessages)),
        [erroredFieldMessages]
    )

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

    // A schema change invalidates any previously-captured "ran clean"
    // result for every dialect — the last run happened against different
    // data. Runs at mount too, which is a no-op (runResults starts empty).
    useEffect(() => {
        setRunResults({})
    }, [activeSchemaSql])

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
            const result = await runQuery(solutionSql)
            const rows = result.rows
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
            setRunResults((prev) => ({ ...prev, [activeDialect]: "clean" }))
        } catch (e: any) {
            setRunStatus(`Error: ${e?.message ?? "query failed"}`)
            setRunResults((prev) => ({ ...prev, [activeDialect]: "error" }))
        } finally {
            setRunning(false)
        }
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setErroredFieldMessages({})
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
                payload.discussionMode = discussionMode
                // Task 11 (SP7) — curriculum placement is edit-only (see
                // CurriculumPlacement's create-mode message): `addCheckpoint`
                // looks the problem up by slug, which doesn't exist to find
                // until create has already committed. `null` explicitly
                // clears a binding; the server treats an omitted field
                // (create's payload never sets this key at all) as "leave
                // it untouched."
                payload.curriculumLessonId = curriculumLessonId || null
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
                // `curriculumNote` (PATCH .../[slug]/route.ts's curriculum-sync
                // step) is banner-only extra context — e.g. "the old binding
                // was already removed" when a reassign's addCheckpoint half
                // fails after removeCheckpoint's already committed. It's kept
                // out of `json.error` itself so the exact-string match just
                // below (and the Curriculum-tab routing it drives) still sees
                // the same message addCheckpoint/removeCheckpoint always
                // returned.
                setError(
                    json.error
                        ? json.curriculumNote
                            ? `${json.error} ${json.curriculumNote}`
                            : json.error
                        : `Request failed: ${res.status}`
                )
                // Zod failures carry `details`; the four hand-thrown route
                // errors (SCHEMA_NOT_FOUND, SLUG_TAKEN, TAGS_NOT_FOUND,
                // PUBLISHED_DIALECT_MAP_INCOMPLETE — see the two API routes'
                // catch blocks) don't, so they're matched on `json.code`
                // first and `json.error`'s text as a fallback (see
                // fieldErrorsFromKnownServerMessage's doc comment for which
                // paths carry no code and stay text-only). Either way the
                // result feeds the same tab-marking + jump path.
                const fieldMessages = json.details
                    ? fieldErrorsFromTreeifiedError(json.details)
                    : fieldErrorsFromKnownServerMessage(json.error, json.missing, json.code)
                if (json.details) console.error("Validation details:", json.details)
                setErroredFieldMessages(fieldMessages)
                const target = firstErroredTab(Object.keys(fieldMessages))
                if (target) setActiveTab(target)
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

    // Validation checklist (Task 10, step 4) — reads state the form
    // already tracks. No new validation rules: these rows don't gate
    // `submitting` or change what the server accepts, they only make
    // existing conditions visible.
    const checklistItems: ChecklistItem[] = useMemo(() => {
        const runEntries = dialects.map((d) => ({ dialect: d, result: runResults[d] }))
        const allClean = runEntries.length > 0 && runEntries.every((e) => e.result === "clean")
        const anyError = runEntries.some((e) => e.result === "error")
        const runDetail = runEntries
            .map(
                (e) =>
                    `${DIALECT_LABELS[e.dialect]}: ${
                        e.result === "clean"
                            ? "clean"
                            : e.result === "error"
                              ? "error"
                              : "not run yet"
                    }`
            )
            .join(" · ")

        const outputEntries = dialects.map((d) => ({
            dialect: d,
            present: Boolean(expectedOutputs[d]?.trim()),
        }))
        const allCaptured =
            outputEntries.length > 0 && outputEntries.every((e) => e.present)
        const outputDetail = outputEntries
            .map((e) => `${DIALECT_LABELS[e.dialect]}: ${e.present ? "captured" : "missing"}`)
            .join(" · ")

        const hasTags = tagSlugs.length > 0

        return [
            {
                id: "runs-clean",
                label: "Solution runs clean on every selected engine",
                state: allClean ? "pass" : anyError ? "fail" : "pending",
                detail: runDetail,
            },
            {
                id: "expected-output",
                label: "Expected output captured and non-empty",
                state: allCaptured ? "pass" : "pending",
                detail: outputDetail,
            },
            {
                id: "tags",
                label: hasTags
                    ? `Tagged (${tagSlugs.length})`
                    : "No tags — won't appear under any topic",
                state: hasTags ? "pass" : "warn",
                detail: hasTags ? undefined : "Add at least one tag on the Basics tab.",
            },
        ]
    }, [dialects, runResults, expectedOutputs, tagSlugs])

    return (
        // noValidate: every tab's fields stay mounted, so a `required`
        // field on a tab OTHER than the active one is still part of the
        // form's constraint-validation set. Left to the browser, clicking
        // Submit while that field is empty aborts the submit event before
        // React's onSubmit ever runs — no fetch, no error banner, no tab
        // switch, nothing — because a hidden control can't be focused for
        // the native validation bubble. (Confirmed by hand: with a hidden
        // required field empty, `form.checkValidity()` is false and a
        // submit click never reaches the network.) Validation is already
        // server-authoritative here (Zod, see the API routes); noValidate
        // guarantees onSubmit always runs so a failed save reaches the
        // fetch call. It does NOT by itself guarantee every failure gets
        // a tab/field marker — that depends on the server response being
        // one `onSubmit` knows how to attribute to a field (Zod `details`,
        // or one of the hand-thrown messages `fieldErrorsFromKnownServerMessage`
        // matches). An error the client can't attribute still surfaces —
        // in the top banner only, same as before this task.
        <form onSubmit={onSubmit} className="space-y-6" noValidate>
            {error && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                </div>
            )}

            <FormTabStrip
                activeTab={activeTab}
                erroredTabs={erroredTabs}
                onSelect={setActiveTab}
            />

            {/* ---- Basics: title, slug, difficulty, status, ordered,
                SQL engines, description, tags, discussion mode ----
                tagSlugs and discussionMode have no dedicated tab in the
                five-tab design and route to "basics" per
                lib/admin/form-tabs.ts's FIELD_TAB_MAP — that map is
                authoritative, this is why they render here rather than in
                their old standalone cards. */}
            <div
                role="tabpanel"
                id="form-tabpanel-basics"
                aria-labelledby="form-tab-basics"
                hidden={activeTab !== "basics"}
                className="space-y-6"
            >
                <Card>
                    <CardHeader>
                        <CardTitle>Basics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid sm:grid-cols-2 gap-4">
                            <Field label="Title" htmlFor="title" required error={erroredFieldMessages.title}>
                                <Input
                                    id="title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="Top customers by revenue"
                                    required
                                />
                            </Field>
                            <Field
                                label="Slug"
                                htmlFor="slug"
                                description="Lowercase, hyphenated. Used in the URL."
                                required
                                error={erroredFieldMessages.slug}
                            >
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
                            <SegmentedControl
                                id="difficulty"
                                label="Difficulty"
                                value={difficulty}
                                onChange={setDifficulty}
                                options={[
                                    { value: "EASY", label: "Easy", activeClassName: "bg-easy-bg text-easy-fg" },
                                    { value: "MEDIUM", label: "Medium", activeClassName: "bg-medium-bg text-medium-fg" },
                                    { value: "HARD", label: "Hard", activeClassName: "bg-hard-bg text-hard-fg" },
                                ]}
                            />
                            <SegmentedControl
                                id="status"
                                label="Status"
                                description="DRAFT/BETA hide from users. PUBLISHED is live."
                                value={status}
                                onChange={setStatus}
                                options={[
                                    { value: "DRAFT", label: "Draft" },
                                    { value: "BETA", label: "Beta" },
                                    { value: "PUBLISHED", label: "Published" },
                                    { value: "ARCHIVED", label: "Archived" },
                                ]}
                            />
                            <Field
                                label="Ordered comparison"
                                htmlFor="ordered"
                                description="If checked, row order matters during validation."
                                error={erroredFieldMessages.ordered}
                            >
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
                            error={erroredFieldMessages.dialects}
                        >
                            <div role="group" aria-label="SQL engines" className="flex flex-wrap gap-2">
                                {(["DUCKDB", "POSTGRES"] as const).map((d) => {
                                    const checked = dialects.includes(d)
                                    const isOnly = checked && dialects.length === 1
                                    return (
                                        <button
                                            key={d}
                                            type="button"
                                            id={`dialect-${d.toLowerCase()}`}
                                            aria-pressed={checked}
                                            disabled={isOnly}
                                            onClick={() => {
                                                if (checked) {
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
                                                } else {
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
                                                }
                                            }}
                                            className={cn(
                                                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                                checked
                                                    ? "border-primary/30 bg-primary/10 text-primary"
                                                    : "border-border bg-surface text-muted-foreground hover:text-foreground hover:border-border-strong"
                                            )}
                                        >
                                            {checked && <Check className="h-3 w-3" aria-hidden="true" />}
                                            {DIALECT_LABELS[d]}
                                        </button>
                                    )
                                })}
                            </div>
                        </Field>
                        <Field
                            label="Description"
                            htmlFor="description"
                            description="What the user has to do. Plain text."
                            required
                            error={erroredFieldMessages.description}
                        >
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
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">
                                Tags
                            </label>
                            <TagPicker value={tagSlugs} onChange={setTagSlugs} />
                            {erroredFieldMessages.tagSlugs && (
                                <p className="text-xs text-destructive">
                                    {erroredFieldMessages.tagSlugs}
                                </p>
                            )}
                        </div>
                        {initial.mode === "edit" && (
                            <Field
                                label="Discussion mode"
                                htmlFor="discussionMode"
                                description="Controls the learner-facing discussion tab for this problem."
                                required
                                error={erroredFieldMessages.discussionMode}
                            >
                                <select
                                    id="discussionMode"
                                    value={discussionMode}
                                    onChange={(e) =>
                                        setDiscussionMode(e.target.value as DiscussionMode)
                                    }
                                    className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="OPEN">
                                        Open - visible and writable
                                    </option>
                                    <option value="LOCKED">
                                        Locked - visible, read-only
                                    </option>
                                    <option value="HIDDEN">
                                        Hidden - learner tab hidden
                                    </option>
                                </select>
                            </Field>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ---- Schema: existing/inline picker + dataset description ----
                schemaDescription lives here (not Basics) per FIELD_TAB_MAP:
                it's dataset-descriptive prose, not a problem setting. */}
            <div
                role="tabpanel"
                id="form-tabpanel-schema"
                aria-labelledby="form-tab-schema"
                hidden={activeTab !== "schema"}
                className="space-y-6"
            >
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
                            <Field
                                label="Schema"
                                htmlFor="schemaId"
                                required
                                error={erroredFieldMessages.schemaId}
                            >
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
                                {erroredFieldMessages.schemaInline && (
                                    <p className="text-xs text-destructive">
                                        {erroredFieldMessages.schemaInline}
                                    </p>
                                )}
                            </div>
                        )}
                        <Field
                            label="Schema description (optional)"
                            htmlFor="schemaDescription"
                            description="Short prose about the dataset. Shown when no input tables are detected."
                            error={erroredFieldMessages.schemaDescription}
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
            </div>

            {/* ---- Solution & expected output ----
                Unchanged Run-and-capture loop and per-dialect
                solutions/expectedOutputs handling — not redesigned here. */}
            <div
                role="tabpanel"
                id="form-tabpanel-solution"
                aria-labelledby="form-tab-solution"
                hidden={activeTab !== "solution"}
                className="space-y-6"
            >
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
                                        className="ml-2 inline-flex items-center rounded-sm px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        <Field label="Solution SQL" htmlFor="solution" error={erroredFieldMessages.solutionSql}>
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
                            error={erroredFieldMessages.expectedOutput}
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
            </div>

            {/* ---- Hints ---- */}
            <div
                role="tabpanel"
                id="form-tabpanel-hints"
                aria-labelledby="form-tab-hints"
                hidden={activeTab !== "hints"}
                className="space-y-6"
            >
                <Card>
                    <CardHeader>
                        <CardTitle>Hints</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <HintsEditor value={hints} onChange={setHints} />
                        {erroredFieldMessages.hints && (
                            <p className="text-xs text-destructive">{erroredFieldMessages.hints}</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ---- Curriculum ----
                Task 11: binds this problem to a lesson via the existing
                LessonCheckpoint relation. See CurriculumPlacement.tsx for
                the three load-bearing rules (no new columns, writes only
                through addCheckpoint/removeCheckpoint, one lesson per
                problem). */}
            <div
                role="tabpanel"
                id="form-tabpanel-curriculum"
                aria-labelledby="form-tab-curriculum"
                hidden={activeTab !== "curriculum"}
                className="space-y-6"
            >
                <CurriculumPlacement
                    mode={initial.mode}
                    value={curriculumLessonId}
                    onChange={setCurriculumLessonId}
                    initialBinding={initial.curriculumBinding ?? null}
                    error={erroredFieldMessages.curriculumLessonId}
                />
            </div>

            <ValidationChecklist items={checklistItems} />

            <div className="flex items-center gap-3 sticky bottom-14 lg:bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-background/80 backdrop-blur border-t border-border">
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
