"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"

interface ProblemOption {
    id: string
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
}

export function RelatedProblemsPicker({
    value,
    onChange,
}: {
    value: string[]
    onChange: (next: string[]) => void
}) {
    const [available, setAvailable] = useState<ProblemOption[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    useEffect(() => {
        ;(async () => {
            try {
                const res = await fetch("/api/admin/problems")
                if (res.ok) {
                    const json = await res.json()
                    setAvailable(json.data ?? [])
                }
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    const selectedSet = useMemo(() => new Set(value), [value])
    const matches = useMemo(() => {
        const q = search.trim().toLowerCase()
        if (!q) return available.filter((p) => !selectedSet.has(p.slug)).slice(0, 8)
        return available
            .filter(
                (p) =>
                    !selectedSet.has(p.slug) &&
                    (p.title.toLowerCase().includes(q) ||
                        p.slug.toLowerCase().includes(q))
            )
            .slice(0, 8)
    }, [available, selectedSet, search])

    function add(slug: string) {
        if (!selectedSet.has(slug)) onChange([...value, slug])
        setSearch("")
    }

    function remove(slug: string) {
        onChange(value.filter((s) => s !== slug))
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {value.length === 0 && (
                    <span className="text-xs text-muted-foreground italic self-center">
                        No problems linked.
                    </span>
                )}
                {value.map((slug) => {
                    const found = available.find((p) => p.slug === slug)
                    return (
                        <button
                            type="button"
                            key={slug}
                            onClick={() => remove(slug)}
                            className="cursor-pointer"
                        >
                            <Badge variant="primary" className="normal-case tracking-normal">
                                {found?.title ?? slug}
                                <X className="h-3 w-3" />
                            </Badge>
                        </button>
                    )
                })}
            </div>
            <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                    loading
                        ? "Loading problems…"
                        : "Search to add a related problem"
                }
                className="text-sm"
            />
            {matches.length > 0 && (
                <div className="rounded-md border border-border bg-surface max-h-60 overflow-y-auto scrollbar-thin">
                    {matches.map((p) => (
                        <button
                            type="button"
                            key={p.id}
                            onClick={() => add(p.slug)}
                            className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-muted/60 transition-colors cursor-pointer"
                        >
                            <span className="text-sm font-medium truncate">
                                {p.title}
                            </span>
                            <span className="inline-flex items-center gap-2 shrink-0">
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
                                    {p.difficulty.toLowerCase()}
                                </span>
                                <Plus className="h-3 w-3 text-muted-foreground" />
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
