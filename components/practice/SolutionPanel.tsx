"use client"

import { useState, type CSSProperties } from "react"
import Link from "next/link"
import { BookOpen, ChevronRight, Lock, Sparkles } from "lucide-react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { getProblemSolution } from "@/actions/solutions"
import type { Dialect } from "@/lib/sql-engine/types"
import { cn } from "@/lib/utils"

const prismTheme = vscDarkPlus as { [key: string]: CSSProperties }

interface SolutionPanelProps {
    slug: string
    /** Allowed dialects for this problem (in `SQLProblem.dialects`). */
    dialects: readonly Dialect[]
    /** Dialect the learner solved on; used as the default tab. */
    activeDialect: Dialect
}

type State =
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "revealed"; solutions: Record<string, string>; visibleDialect: Dialect }
    | { kind: "signin-required" }
    | { kind: "error"; message: string }

/**
 * Renders below `ValidationResult` when the learner has just been ACCEPTED.
 * The canonical SQL is hidden behind a deliberate reveal step so learners
 * can choose to peek at the answer rather than have it forced on them.
 *
 * Anonymous viewers don't even see the reveal button — they see a sign-in
 * nudge. (The server action would refuse anyway, but the nudge converts
 * better when surfaced inline.)
 */
export function SolutionPanel({ slug, dialects, activeDialect }: SolutionPanelProps) {
    const [state, setState] = useState<State>({ kind: "idle" })

    const handleReveal = async () => {
        setState({ kind: "loading" })
        try {
            const result = await getProblemSolution(slug)
            if (result.found) {
                // Prefer the dialect the learner just solved on. Fall back
                // to the first available solution if (somehow) that dialect
                // isn't in the response.
                const visibleDialect =
                    result.solutions[activeDialect] !== undefined
                        ? activeDialect
                        : (Object.keys(result.solutions)[0] as Dialect)
                if (!visibleDialect) {
                    setState({
                        kind: "error",
                        message:
                            "No canonical solution is published for this problem yet.",
                    })
                    return
                }
                setState({
                    kind: "revealed",
                    solutions: result.solutions,
                    visibleDialect,
                })
                return
            }
            if (result.reason === "not-signed-in") {
                setState({ kind: "signin-required" })
                return
            }
            // "not-solved" / "not-found" should be unreachable when the
            // panel is rendered (we gate on `validation.ok`), but handle
            // defensively so a stale submit cookie doesn't blank the UI.
            setState({
                kind: "error",
                message:
                    result.reason === "not-solved"
                        ? "Submit your solution successfully to unlock the canonical answer."
                        : "Problem not found.",
            })
        } catch (err) {
            setState({
                kind: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Couldn't load the solution.",
            })
        }
    }

    if (state.kind === "revealed") {
        return (
            <div className="mt-3 rounded-lg border border-border bg-surface">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Sparkles className="h-4 w-4 text-accent" />
                        Canonical solution
                    </div>
                    {Object.keys(state.solutions).length > 1 ? (
                        <div className="flex items-center gap-1 rounded-md border border-border bg-surface-muted p-0.5">
                            {dialects.map((d) => {
                                if (state.solutions[d] === undefined) return null
                                const active = state.visibleDialect === d
                                return (
                                    <button
                                        key={d}
                                        type="button"
                                        onClick={() =>
                                            setState({
                                                ...state,
                                                visibleDialect: d,
                                            })
                                        }
                                        aria-pressed={active}
                                        className={cn(
                                            "px-2 py-0.5 text-[11px] font-medium rounded-sm transition-colors",
                                            active
                                                ? "bg-surface text-foreground"
                                                : "text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {d === "DUCKDB" ? "DuckDB" : "Postgres"}
                                    </button>
                                )
                            })}
                        </div>
                    ) : null}
                </div>
                <div className="px-1">
                    <SyntaxHighlighter
                        style={prismTheme}
                        language="sql"
                        PreTag="div"
                        customStyle={{
                            margin: 0,
                            padding: "0.875rem 1rem",
                            background: "transparent",
                            fontSize: "12.5px",
                            lineHeight: "1.55",
                            borderRadius: 0,
                        }}
                    >
                        {state.solutions[state.visibleDialect] ?? ""}
                    </SyntaxHighlighter>
                </div>
                <div className="px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
                    There are many valid solutions — this is the one we publish.
                    Compare against yours to spot patterns, not to match exactly.
                </div>
            </div>
        )
    }

    if (state.kind === "signin-required") {
        return (
            <div className="mt-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
                <div className="flex items-start gap-3">
                    <Lock className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground">
                            Sign in to see the canonical solution
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            We hide solutions from anonymous viewers. Sign in
                            (it's free) and your accepted submission unlocks it.
                        </div>
                        <Link
                            href={`/auth/signin?callbackUrl=${encodeURIComponent(`/practice/${slug}`)}`}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                            Sign in
                            <ChevronRight className="h-3 w-3" />
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (state.kind === "error") {
        return (
            <div className="mt-3 rounded-lg border border-border bg-surface-muted px-4 py-3 text-sm text-muted-foreground">
                {state.message}
            </div>
        )
    }

    // idle + loading
    return (
        <div className="mt-3 rounded-lg border border-border bg-surface-muted px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground font-medium">
                        Want to see how we solved it?
                    </span>
                </div>
                <button
                    type="button"
                    onClick={handleReveal}
                    disabled={state.kind === "loading"}
                    className={cn(
                        "inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium",
                        "hover:bg-surface-muted transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    )}
                >
                    {state.kind === "loading" ? "Loading…" : "Reveal solution"}
                    {state.kind !== "loading" && (
                        <ChevronRight className="h-3 w-3" />
                    )}
                </button>
            </div>
        </div>
    )
}
