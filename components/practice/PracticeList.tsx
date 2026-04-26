"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Search } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { DifficultyBadge, Badge } from "@/components/ui/Badge"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { EmptyState } from "@/components/ui/EmptyState"
import { cn } from "@/lib/utils"

type Difficulty = "EASY" | "MEDIUM" | "HARD"
type StatusFilter = "ALL" | "SOLVED" | "TODO"

interface Problem {
    id: string
    slug: string
    title: string
    description: string | null
    difficulty: Difficulty
}

const DIFFICULTIES: ("ALL" | Difficulty)[] = ["ALL", "EASY", "MEDIUM", "HARD"]

interface PracticeListProps {
    problems: Problem[]
    solvedSlugs: string[]
}

export function PracticeList({ problems, solvedSlugs }: PracticeListProps) {
    const solvedSet = useMemo(() => new Set(solvedSlugs), [solvedSlugs])
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
    const [query, setQuery] = useState("")
    const [filter, setFilter] = useState<"ALL" | Difficulty>("ALL")

    const counts = useMemo(() => {
        const c = { EASY: 0, MEDIUM: 0, HARD: 0 }
        for (const p of problems) c[p.difficulty]++
        return c
    }, [problems])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return problems.filter((p) => {
            if (filter !== "ALL" && p.difficulty !== filter) return false
            if (statusFilter === "SOLVED" && !solvedSet.has(p.slug)) return false
            if (statusFilter === "TODO" && solvedSet.has(p.slug)) return false
            if (!q) return true
            return (
                p.title.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
            )
        })
    }, [problems, query, filter, statusFilter, solvedSet])

    return (
        <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search problems…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                        {DIFFICULTIES.map((d) => {
                            const active = filter === d
                            const count =
                                d === "ALL"
                                    ? problems.length
                                    : counts[d as Difficulty]
                            return (
                                <Button
                                    key={d}
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setFilter(d)}
                                    aria-pressed={active}
                                    className={cn(
                                        "rounded-sm font-medium",
                                        active
                                            ? "bg-surface-muted text-foreground"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {d === "ALL" ? "All" : d.charAt(0) + d.slice(1).toLowerCase()}
                                    <span className="ml-1.5 text-[10px] tabular-nums text-muted-foreground">
                                        {count}
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                    {solvedSlugs.length > 0 && (
                        <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1">
                            {(["ALL", "TODO", "SOLVED"] as StatusFilter[]).map((s) => {
                                const active = statusFilter === s
                                const label =
                                    s === "ALL" ? "Status" : s === "TODO" ? "Todo" : "Solved"
                                return (
                                    <Button
                                        key={s}
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setStatusFilter(s)}
                                        aria-pressed={active}
                                        className={cn(
                                            "rounded-sm font-medium",
                                            active
                                                ? "bg-surface-muted text-foreground"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {label}
                                    </Button>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>

            {filtered.length === 0 ? (
                <EmptyState
                    icon={<Search className="h-5 w-5" />}
                    title="No problems match your filters"
                    description="Try clearing the search or switching difficulty."
                />
            ) : (
                <Card className="overflow-hidden">
                    <div className="hidden md:grid grid-cols-[2.5rem_3rem_1fr_8rem_3rem] items-center gap-4 px-6 py-3 border-b border-border bg-surface-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                        <span className="sr-only">Status</span>
                        <span>#</span>
                        <span>Title</span>
                        <span>Difficulty</span>
                        <span className="sr-only">Open</span>
                    </div>
                    <ul className="divide-y divide-border">
                        {filtered.map((p, i) => {
                            const solved = solvedSet.has(p.slug)
                            return (
                            <li key={p.id}>
                                <Link
                                    href={`/practice/${p.slug}`}
                                    className="grid grid-cols-[1fr_auto] md:grid-cols-[2.5rem_3rem_1fr_8rem_3rem] items-center gap-4 px-4 md:px-6 py-4 hover:bg-surface-muted/60 transition-colors group"
                                >
                                    <span className="hidden md:flex items-center justify-center" aria-label={solved ? "Solved" : "Not solved"}>
                                        {solved ? (
                                            <CheckCircle2 className="h-4 w-4 text-easy" />
                                        ) : (
                                            <span className="h-2 w-2 rounded-full bg-border-strong" />
                                        )}
                                    </span>
                                    <span className="hidden md:inline text-xs tabular-nums text-muted-foreground">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <div className="min-w-0">
                                        <h3 className={cn(
                                            "font-medium truncate transition-colors",
                                            solved ? "text-muted-foreground" : "text-foreground group-hover:text-primary"
                                        )}>
                                            <span className="md:hidden inline-flex items-center mr-1.5 align-middle">
                                                {solved ? <CheckCircle2 className="h-3.5 w-3.5 text-easy" /> : null}
                                            </span>
                                            {p.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
                                            {p.description}
                                        </p>
                                        <div className="mt-2 md:hidden">
                                            <DifficultyBadge difficulty={p.difficulty} />
                                        </div>
                                    </div>
                                    <div className="hidden md:flex">
                                        <DifficultyBadge difficulty={p.difficulty} />
                                    </div>
                                    <ArrowRight className="hidden md:block h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-[color,translate] duration-150" />
                                    <ArrowRight className="md:hidden h-4 w-4 text-muted-foreground" />
                                </Link>
                            </li>
                        )
                        })}
                    </ul>
                </Card>
            )}
        </div>
    )
}
