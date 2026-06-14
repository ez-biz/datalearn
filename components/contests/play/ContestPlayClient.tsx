"use client"

import { useCallback, useState } from "react"
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
import { ContestCountdown } from "./ContestCountdown"

type PlayProblem = {
    id: string
    number: number
    title: string
    slug: string
    schemaSql: string | null
    dialect: Dialect
}

type Props = {
    contestSlug: string
    contestTitle: string
    endsAt: string
    problem: PlayProblem
    points: number
    mode: PlayMode
}

type LocalResult = {
    rows: unknown[]
    rowCount: number
    truncated: boolean
    error: string | null
}

export function ContestPlayClient({
    contestSlug,
    contestTitle,
    endsAt,
    problem,
    points,
    mode,
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

    const { ready, runQuery } = useProblemDB(problem.schemaSql, problem.dialect, {
        problemSlug: problem.slug,
    })

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
        try {
            const res = await fetch(`/api/contests/${contestSlug}/submit`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemId: problem.id,
                    sql,
                    dialect: problem.dialect,
                    idempotencyKey: crypto.randomUUID(),
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
    }, [submitting, sql, contestSlug, problem.id, problem.dialect, points])

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
                    href={`/contests/${contestSlug}`}
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
                    href={`/contests/${contestSlug}`}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    {contestTitle}
                </Link>
                <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">{points} pts</Badge>
                    <ContestCountdown
                        endsAt={endsAt}
                        onExpire={() => setExpired(true)}
                    />
                </div>
            </div>

            <h1 className="text-xl font-semibold tracking-tight">
                #{problem.number}. {problem.title}
            </h1>

            <SqlEditor
                value={sql}
                onChange={(v) => setSql(v ?? "")}
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
                        disabled={submitting || !sql.trim()}
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
