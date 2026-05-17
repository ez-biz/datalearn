"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowDown,
    ArrowUp,
    Loader2,
    Plus,
    Save,
    Search,
    Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { cn } from "@/lib/utils"

type TrackProblem = {
    id: string
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    status?: string
}

type TrackItem = {
    id: string
    position: number
    problem: TrackProblem
}

type AdminTrack = {
    slug: string
    name: string
    summary: string
    description: string
    difficulty: "EASY" | "MEDIUM" | "HARD" | "MIXED"
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED"
    estimatedMinutes: number
    coverImageUrl: string | null
    items: TrackItem[]
}

export function TrackEditor({
    track,
    allProblems,
}: {
    track: AdminTrack
    allProblems: TrackProblem[]
}) {
    const router = useRouter()
    const [currentSlug, setCurrentSlug] = useState(track.slug)
    const [name, setName] = useState(track.name)
    const [slug, setSlug] = useState(track.slug)
    const [summary, setSummary] = useState(track.summary)
    const [description, setDescription] = useState(track.description)
    const [difficulty, setDifficulty] = useState(track.difficulty)
    const [status, setStatus] = useState(track.status)
    const [estimatedMinutes, setEstimatedMinutes] = useState(
        track.estimatedMinutes,
    )
    const [coverImageUrl, setCoverImageUrl] = useState(
        track.coverImageUrl ?? "",
    )
    const [items, setItems] = useState(track.items)
    const [query, setQuery] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    const existingProblemIds = useMemo(
        () => new Set(items.map((item) => item.problem.id)),
        [items],
    )
    const candidates = allProblems
        .filter((problem) => !existingProblemIds.has(problem.id))
        .filter((problem) => {
            const q = query.trim().toLowerCase()
            if (!q) return true
            return (
                problem.title.toLowerCase().includes(q) ||
                problem.slug.toLowerCase().includes(q) ||
                String(problem.number).includes(q)
            )
        })
        .slice(0, 12)

    function saveMetadata(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        startTransition(async () => {
            const res = await fetch(`/api/admin/tracks/${currentSlug}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: slug.trim(),
                    summary: summary.trim(),
                    description: description.trim(),
                    difficulty,
                    status,
                    estimatedMinutes,
                    coverImageUrl: coverImageUrl.trim() || null,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to save track.")
                return
            }
            setCurrentSlug(json.data.slug)
            if (json.data.slug !== currentSlug) {
                router.replace(`/admin/tracks/${json.data.slug}/edit`)
            }
            router.refresh()
        })
    }

    function addProblem(problem: TrackProblem) {
        setError(null)
        startTransition(async () => {
            const res = await fetch(`/api/admin/tracks/${currentSlug}/items`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ problemSlug: problem.slug }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to add problem.")
                return
            }
            setItems((prev) => [
                ...prev,
                {
                    id: json.data.id,
                    position: prev.length,
                    problem,
                },
            ])
            setQuery("")
            router.refresh()
        })
    }

    function move(index: number, delta: -1 | 1) {
        const target = index + delta
        if (target < 0 || target >= items.length) return
        const next = [...items]
        ;[next[index], next[target]] = [next[target], next[index]]
        setItems(next)
        setError(null)
        startTransition(async () => {
            const res = await fetch(
                `/api/admin/tracks/${currentSlug}/reorder`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        itemIds: next.map((item) => item.id),
                    }),
                },
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to reorder track.")
                setItems(items)
                return
            }
            setItems((prev) =>
                prev.map((item, position) => ({ ...item, position })),
            )
            router.refresh()
        })
    }

    function removeItem(itemId: string) {
        const next = items.filter((item) => item.id !== itemId)
        setItems(next)
        setError(null)
        startTransition(async () => {
            const res = await fetch(
                `/api/admin/tracks/${currentSlug}/items/${itemId}`,
                { method: "DELETE" },
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to remove item.")
                setItems(items)
                return
            }
            router.refresh()
        })
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        {track.name}
                    </h1>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                        /{currentSlug}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={status === "PUBLISHED" ? "primary" : "secondary"}>
                        {status.toLowerCase()}
                    </Badge>
                    <Badge variant="outline">
                        {items.length} {items.length === 1 ? "item" : "items"}
                    </Badge>
                </div>
            </header>

            {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            ) : null}

            <Card>
                <CardContent className="p-5">
                    <form onSubmit={saveMetadata} className="grid gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Name" htmlFor="edit-track-name" required>
                                <Input
                                    id="edit-track-name"
                                    value={name}
                                    onChange={(event) =>
                                        setName(event.target.value)
                                    }
                                    required
                                />
                            </Field>
                            <Field label="Slug" htmlFor="edit-track-slug" required>
                                <Input
                                    id="edit-track-slug"
                                    value={slug}
                                    onChange={(event) =>
                                        setSlug(event.target.value)
                                    }
                                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                    required
                                />
                            </Field>
                        </div>
                        <Field label="Summary" htmlFor="edit-track-summary" required>
                            <Input
                                id="edit-track-summary"
                                value={summary}
                                onChange={(event) =>
                                    setSummary(event.target.value)
                                }
                                maxLength={500}
                                required
                            />
                        </Field>
                        <Field
                            label="Description"
                            htmlFor="edit-track-description"
                            required
                        >
                            <Textarea
                                id="edit-track-description"
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                rows={6}
                                className="font-sans"
                                required
                            />
                        </Field>
                        <div className="grid gap-4 sm:grid-cols-4">
                            <Field label="Status" htmlFor="edit-track-status">
                                <select
                                    id="edit-track-status"
                                    value={status}
                                    onChange={(event) =>
                                        setStatus(
                                            event.target.value as AdminTrack["status"],
                                        )
                                    }
                                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="DRAFT">Draft</option>
                                    <option value="PUBLISHED">Published</option>
                                    <option value="ARCHIVED">Archived</option>
                                </select>
                            </Field>
                            <Field
                                label="Difficulty"
                                htmlFor="edit-track-difficulty"
                            >
                                <select
                                    id="edit-track-difficulty"
                                    value={difficulty}
                                    onChange={(event) =>
                                        setDifficulty(
                                            event.target
                                                .value as AdminTrack["difficulty"],
                                        )
                                    }
                                    className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="EASY">Easy</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="HARD">Hard</option>
                                    <option value="MIXED">Mixed</option>
                                </select>
                            </Field>
                            <Field
                                label="Minutes"
                                htmlFor="edit-track-minutes"
                            >
                                <Input
                                    id="edit-track-minutes"
                                    type="number"
                                    min={1}
                                    max={10000}
                                    value={estimatedMinutes}
                                    onChange={(event) =>
                                        setEstimatedMinutes(
                                            Number(event.target.value),
                                        )
                                    }
                                />
                            </Field>
                            <Field
                                label="Cover URL"
                                htmlFor="edit-track-cover"
                            >
                                <Input
                                    id="edit-track-cover"
                                    type="url"
                                    value={coverImageUrl}
                                    onChange={(event) =>
                                        setCoverImageUrl(event.target.value)
                                    }
                                    placeholder="https://..."
                                />
                            </Field>
                        </div>
                        <div>
                            <Button type="submit" disabled={pending}>
                                {pending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Save track
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardContent className="p-5">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="text-base font-semibold">Items</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Problems render in this order on the learner
                                track page.
                            </p>
                        </div>
                        <div className="relative w-full sm:w-80">
                            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                className="pl-8"
                                placeholder="Search problems to add"
                            />
                        </div>
                    </div>

                    {query.trim() ? (
                        <ul className="mb-4 divide-y divide-border rounded-md border border-border">
                            {candidates.length === 0 ? (
                                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                                    No matching problems.
                                </li>
                            ) : (
                                candidates.map((problem) => (
                                    <li
                                        key={problem.id}
                                        className="grid grid-cols-[3rem_1fr_auto_auto] items-center gap-3 px-3 py-2"
                                    >
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                            {problem.number}
                                        </span>
                                        <span className="truncate text-sm">
                                            {problem.title}
                                        </span>
                                        <DifficultyBadge
                                            difficulty={problem.difficulty}
                                        />
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addProblem(problem)}
                                            disabled={pending}
                                        >
                                            <Plus className="h-3.5 w-3.5" />
                                            Add
                                        </Button>
                                    </li>
                                ))
                            )}
                        </ul>
                    ) : null}

                    {items.length === 0 ? (
                        <EmptyState
                            title="No items yet"
                            description="Search for a published problem above to add it to this track."
                        />
                    ) : (
                        <ul className="divide-y divide-border rounded-md border border-border">
                            {items.map((item, index) => (
                                <li
                                    key={item.id}
                                    className="grid grid-cols-[2.5rem_3rem_1fr_auto_auto_auto] items-center gap-3 px-3 py-3"
                                >
                                    <div className="flex flex-col gap-1">
                                        <button
                                            type="button"
                                            onClick={() => move(index, -1)}
                                            disabled={pending || index === 0}
                                            aria-label="Move up"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => move(index, 1)}
                                            disabled={
                                                pending ||
                                                index === items.length - 1
                                            }
                                            aria-label="Move down"
                                            className="inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                                        >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                    <span className="text-xs tabular-nums text-muted-foreground">
                                        {index + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <Link
                                            href={`/practice/${item.problem.slug}`}
                                            className="block truncate font-medium hover:text-primary"
                                        >
                                            {item.problem.title}
                                        </Link>
                                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                                            #{item.problem.number} ·{" "}
                                            {item.problem.slug}
                                        </p>
                                    </div>
                                    <DifficultyBadge
                                        difficulty={item.problem.difficulty}
                                    />
                                    {item.problem.status &&
                                    item.problem.status !== "PUBLISHED" ? (
                                        <Badge variant="outline">
                                            {item.problem.status.toLowerCase()}
                                        </Badge>
                                    ) : (
                                        <span aria-hidden />
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => removeItem(item.id)}
                                        disabled={pending}
                                        aria-label="Remove from track"
                                        className={cn(
                                            "inline-flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
                                        )}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
