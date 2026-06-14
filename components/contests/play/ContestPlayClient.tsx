"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { ContestVerdict } from "@prisma/client"
import type { Dialect } from "@/lib/use-problem-db"
import { useProblemDB } from "@/lib/use-problem-db"
import { SqlEditor } from "@/components/sql/SqlEditor"
import { ResultTable } from "@/components/sql/ResultTable"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { verdictLabel, type PlayMode } from "@/lib/contests/play"
import { submitCustomContestEntry } from "@/actions/custom-contests"
import { ContestCountdown } from "./ContestCountdown"

type PlayProblem = {
    id: string
    number: number
    title: string
    slug: string
    schemaSql: string | null
    dialect: Dialect
}

type Sibling = { letter: string; slug: string }

type Props = {
    /**
     * The contest's DETAIL page URL (e.g. `/contests/<slug>` for official,
     * `/contests/custom/<slug>` for custom). The back-link and the
     * NOT_REGISTERED gate point here, and sibling play URLs are
     * `${contestHref}/${problemSlug}`.
     */
    contestHref: string
    contestSlug: string
    contestTitle: string
    endsAt: string
    problem: PlayProblem
    points: number
    mode: PlayMode
    siblings: Sibling[]
    /**
     * How a submission is graded. OFFICIAL posts raw SQL to the server judge;
     * PRACTICE (custom contests) runs the query in-browser and submits the
     * resulting rows to the practice-judge server action.
     */
    judge?: "OFFICIAL" | "PRACTICE"
}

type LocalResult = {
    rows: unknown[]
    rowCount: number
    truncated: boolean
    error: string | null
}

export function ContestPlayClient({
    contestHref,
    contestSlug,
    contestTitle,
    endsAt,
    problem,
    points,
    mode,
    siblings,
    judge = "OFFICIAL",
}: Props) {
    const [sql, setSql] = useState("")
    const [result, setResult] = useState<LocalResult | null>(null)
    const [running, setRunning] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [expired, setExpired] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [verdict, setVerdict] = useState<{
        text: string
        tone: "success" | "error" | "neutral"
        attempt: number
    } | null>(null)

    // Idempotency key for the current SQL. Held stable so a retry after a
    // network error reuses the key (no extra judged attempt); editing the SQL
    // invalidates it so the next submission is a fresh attempt.
    const idempotencyKeyRef = useRef<string | null>(null)

    const { ready, runQuery } = useProblemDB(problem.schemaSql, problem.dialect, {
        problemSlug: problem.slug,
    })

    // Warm the server judge as soon as a registered participant opens the
    // problem. The official judge forks a fresh worker per submission and the
    // first fork on a cold serverless instance is slow (native engine load);
    // pinging it now — while the contestant writes SQL — moves that cost off the
    // first real submission. Fire-and-forget: PRACTICE-judged custom contests
    // grade in-browser and need no server warm-up. The ping hits the same route
    // as the submit POST, so it warms the function that will judge.
    useEffect(() => {
        if (judge !== "OFFICIAL" || mode !== "PLAY") return
        void fetch(
            `/api/contests/${contestSlug}/submit?warm=1&dialect=${problem.dialect}`,
            { method: "GET" }
        ).catch(() => {})
    }, [judge, mode, contestSlug, problem.dialect])

    const handleSqlChange = useCallback((value: string | undefined) => {
        setSql(value ?? "")
        idempotencyKeyRef.current = null
    }, [])

    const handleExpire = useCallback(() => setExpired(true), [])

    const runLocal = useCallback(async () => {
        if (!ready || running || !sql.trim()) return
        setRunning(true)
        try {
            const out = await runQuery(sql)
            setResult({
                rows: out.rows,
                rowCount: out.rowCount,
                truncated: out.truncated,
                error: null,
            })
        } catch (err) {
            setResult({
                rows: [],
                rowCount: 0,
                truncated: false,
                error: err instanceof Error ? err.message : "Query failed",
            })
        } finally {
            setRunning(false)
        }
    }, [ready, running, sql, runQuery])

    const submit = useCallback(async () => {
        if (submitting || !sql.trim()) return
        setSubmitting(true)
        setSubmitError(null)
        setVerdict(null)

        if (judge === "PRACTICE") {
            // Run the query in-browser (same shape as runLocal), surface the
            // rows in the result table, then practice-judge them server-side.
            // No official judge endpoint, no idempotency key.
            try {
                const out = await runQuery(sql)
                setResult({
                    rows: out.rows,
                    rowCount: out.rowCount,
                    truncated: out.truncated,
                    error: null,
                })
                const result = await submitCustomContestEntry({
                    slug: contestSlug,
                    problemId: problem.id,
                    dialect: problem.dialect,
                    userResult: out.rows,
                })
                if (!result.ok) {
                    setSubmitError(result.error)
                    return
                }
                setVerdict({
                    ...verdictLabel(result.verdict, points),
                    attempt: result.attemptNumber,
                })
            } catch (err) {
                setSubmitError(
                    err instanceof Error ? err.message : "Query failed"
                )
            } finally {
                setSubmitting(false)
            }
            return
        }

        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = crypto.randomUUID()
        }
        try {
            const res = await fetch(`/api/contests/${contestSlug}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemId: problem.id,
                    sql,
                    dialect: problem.dialect,
                    idempotencyKey: idempotencyKeyRef.current,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setSubmitError(json.error ?? "Submission failed. Try again.")
                return
            }
            const data = json.data as {
                verdict: ContestVerdict
                attemptNumber: number
            }
            setVerdict({
                ...verdictLabel(data.verdict, points),
                attempt: data.attemptNumber,
            })
        } catch {
            setSubmitError("Network error. Try again.")
        } finally {
            setSubmitting(false)
        }
    }, [
        submitting,
        sql,
        judge,
        runQuery,
        contestSlug,
        problem.id,
        problem.dialect,
        points,
    ])

    if (mode === "SIGNED_OUT") {
        return <Gate>Sign in to compete in this contest.</Gate>
    }
    if (mode === "NOT_STARTED") {
        return <Gate>This contest hasn&apos;t started yet.</Gate>
    }
    if (mode === "NOT_REGISTERED") {
        return (
            <Gate>
                Register on the{" "}
                <Link
                    href={contestHref}
                    className="text-primary hover:underline"
                >
                    contest page
                </Link>{" "}
                to compete.
            </Gate>
        )
    }

    const canSubmit = mode === "PLAY" && !expired

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Link
                    href={contestHref}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {contestTitle}
                </Link>
                <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">{points} pts</Badge>
                    <ContestCountdown endsAt={endsAt} onExpire={handleExpire} />
                </div>
            </div>

            {siblings.length > 1 && (
                <nav
                    aria-label="Contest problems"
                    className="flex flex-wrap gap-1"
                >
                    {siblings.map((sibling) => (
                        <Link
                            key={sibling.slug}
                            href={`${contestHref}/${sibling.slug}`}
                            aria-current={
                                sibling.slug === problem.slug ? "page" : undefined
                            }
                            className={cn(
                                "inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-medium tabular-nums transition-colors",
                                sibling.slug === problem.slug
                                    ? "bg-primary text-primary-foreground"
                                    : "border border-border text-muted-foreground hover:bg-surface-muted"
                            )}
                        >
                            {sibling.letter}
                        </Link>
                    ))}
                </nav>
            )}

            <h1 className="text-xl font-semibold tracking-tight">
                #{problem.number}. {problem.title}
            </h1>

            <SqlEditor
                value={sql}
                onChange={handleSqlChange}
                onRun={runLocal}
                onSubmit={canSubmit ? submit : undefined}
                running={running || submitting}
                runDisabled={!ready}
                dialect={problem.dialect}
            />

            <div className="flex flex-wrap items-center gap-3">
                {canSubmit ? (
                    <button
                        type="button"
                        onClick={submit}
                        disabled={
                            submitting ||
                            !sql.trim() ||
                            (judge === "PRACTICE" && !ready)
                        }
                        className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                    >
                        {submitting ? "Submitting…" : "Submit to contest"}
                    </button>
                ) : (
                    <span className="text-sm text-muted-foreground">
                        {mode === "ENDED"
                            ? "This contest has ended — submissions are closed."
                            : "Submissions are closed."}
                    </span>
                )}
                {verdict && (
                    <span
                        className={cn(
                            "text-sm font-medium",
                            verdict.tone === "success" && "text-easy-fg",
                            verdict.tone === "error" && "text-destructive",
                            verdict.tone === "neutral" && "text-muted-foreground"
                        )}
                    >
                        {verdict.text} · attempt {verdict.attempt}
                    </span>
                )}
                {submitError && (
                    <span className="text-sm text-destructive" role="alert">
                        {submitError}
                    </span>
                )}
            </div>

            <ResultTable
                data={result?.rows ?? []}
                error={result?.error}
                rowCount={result?.rowCount}
                truncated={result?.truncated}
            />
        </div>
    )
}

function Gate({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-md border border-border bg-surface p-6 text-sm text-muted-foreground">
            {children}
        </div>
    )
}
