"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { Check, Circle, PanelLeftClose, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import {
    buildPanelGroups,
    type PanelMode,
    type PanelProblem,
} from "@/lib/workspace/problems-panel-model"

const MODES: Array<{ key: PanelMode; label: string }> = [
    { key: "track", label: "Track order" },
    { key: "todo", label: "Todo" },
    { key: "tags", label: "Tags" },
]

const DIFFICULTY_LETTER: Record<PanelProblem["difficulty"], string> = {
    EASY: "E",
    MEDIUM: "M",
    HARD: "H",
}

const DIFFICULTY_CLASS: Record<PanelProblem["difficulty"], string> = {
    EASY: "text-easy",
    MEDIUM: "text-medium",
    HARD: "text-hard",
}

interface ProblemsPanelProps {
    problems: PanelProblem[]
    currentSlug: string
    onClose: () => void
}

export function ProblemsPanel({
    problems,
    currentSlug,
    onClose,
}: ProblemsPanelProps) {
    const [mode, setMode] = useState<PanelMode>("track")
    const [filter, setFilter] = useState("")

    // All the decisions about what these rows are live in the pure model —
    // this component only renders the result.
    const groups = useMemo(
        () => buildPanelGroups(problems, mode, filter),
        [problems, mode, filter]
    )

    return (
        <>
            <div className="flex shrink-0 items-center justify-between border-b border-line-soft px-3 py-2.5">
                <div className="flex items-baseline gap-2">
                    <span className="font-mono text-[11px] uppercase tracking-wider text-text-3">
                        All problems
                    </span>
                    <span className="font-mono text-[11px] tabular-nums text-text-dim">
                        {problems.length}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close problems panel"
                    className="rounded-md p-1 text-text-3 transition-colors duration-150 hover:bg-panel-hover hover:text-text-2"
                >
                    <PanelLeftClose className="h-4 w-4" aria-hidden />
                </button>
            </div>

            <div className="shrink-0 px-3 pt-3">
                <div className="relative">
                    <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-dim"
                        aria-hidden
                    />
                    <input
                        type="search"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Filter problems..."
                        aria-label="Filter problems"
                        className="w-full rounded-md border border-line-soft bg-panel-sunken py-1.5 pl-8 pr-2 text-[13px] text-text-2 placeholder:text-text-dim focus:border-line-strong focus:outline-none"
                    />
                </div>
            </div>

            <div
                className="flex shrink-0 gap-1.5 px-3 py-3"
                role="group"
                aria-label="Grouping"
            >
                {MODES.map((m) => (
                    <button
                        key={m.key}
                        type="button"
                        onClick={() => setMode(m.key)}
                        aria-pressed={mode === m.key}
                        className={cn(
                            "rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-wider transition-colors duration-150",
                            mode === m.key
                                ? "bg-panel-active text-text-2"
                                : "text-text-dim hover:bg-panel-hover hover:text-text-3"
                        )}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-4">
                {groups.length === 0 ? (
                    <p className="px-3 py-6 text-[13px] text-text-dim">
                        No problems match “{filter.trim()}”.
                    </p>
                ) : (
                    groups.map((group) => (
                        <section key={group.key} aria-label={group.label}>
                            <div className="flex items-baseline justify-between px-3 pb-1 pt-4">
                                <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                                    {group.label}
                                </span>
                                <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                    {group.done}/{group.total}
                                </span>
                            </div>
                            <ul>
                                {group.problems.map((problem) => {
                                    const current = problem.slug === currentSlug
                                    return (
                                        <li key={`${group.key}:${problem.slug}`}>
                                            <Link
                                                href={`/practice/${problem.slug}`}
                                                aria-current={current ? "page" : undefined}
                                                className={cn(
                                                    "grid grid-cols-[16px_34px_1fr_14px] items-center gap-2 px-3 py-1.5 transition-colors duration-150",
                                                    current
                                                        ? "bg-primary/10 text-foreground"
                                                        : "hover:bg-panel-hover"
                                                )}
                                            >
                                                {problem.solved ? (
                                                    <Check
                                                        className="h-3.5 w-3.5 text-primary"
                                                        aria-label="Solved"
                                                    />
                                                ) : (
                                                    <Circle
                                                        className="h-3 w-3 text-text-dim"
                                                        aria-hidden
                                                    />
                                                )}
                                                <span className="font-mono text-[11px] tabular-nums text-text-dim">
                                                    {problem.number}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "truncate text-[13px]",
                                                        current ? "text-foreground" : "text-text-2"
                                                    )}
                                                >
                                                    {problem.title}
                                                </span>
                                                <span
                                                    className={cn(
                                                        "font-mono text-[11px]",
                                                        DIFFICULTY_CLASS[problem.difficulty]
                                                    )}
                                                    aria-label={problem.difficulty.toLowerCase()}
                                                >
                                                    {DIFFICULTY_LETTER[problem.difficulty]}
                                                </span>
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                        </section>
                    ))
                )}
            </div>
        </>
    )
}
