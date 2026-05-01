"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    CheckCircle2,
    Circle,
    GripVertical,
    Loader2,
    Pencil,
    Plus,
    Search,
    Trash2,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import {
    addToList,
    deleteList,
    removeFromList,
    renameList,
    reorderList,
    type ListWithItems,
} from "@/actions/lists"
import { cn } from "@/lib/utils"

type PickerProblem = {
    id: string
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD" | string
}

type SortKey = "manual" | "added-desc" | "solved-desc" | "unsolved-first" | "number"

const SORT_LABELS: Record<SortKey, string> = {
    manual: "Manual order",
    "added-desc": "Recently added",
    "solved-desc": "Recently solved",
    "unsolved-first": "Unsolved first",
    number: "Problem number",
}

function formatRelative(date: Date | null | undefined): string {
    if (!date) return ""
    const d = date instanceof Date ? date : new Date(date)
    const diff = Date.now() - d.getTime()
    const minutes = Math.round(diff / 60_000)
    if (minutes < 1) return "just now"
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.round(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.round(hours / 24)
    if (days < 30) return `${days}d ago`
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function ListDetail({
    list,
    allProblems,
}: {
    list: ListWithItems
    allProblems: PickerProblem[]
}) {
    const router = useRouter()
    const [editing, setEditing] = useState(false)
    const [name, setName] = useState(list.name)
    const [description, setDescription] = useState(list.description ?? "")
    const [items, setItems] = useState(list.items)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const [sortKey, setSortKey] = useState<SortKey>("manual")
    const [dragId, setDragId] = useState<string | null>(null)
    const [dragOverId, setDragOverId] = useState<string | null>(null)

    const isManual = sortKey === "manual"

    const displayItems = (() => {
        const arr = [...items]
        switch (sortKey) {
            case "added-desc":
                return arr.sort(
                    (a, b) =>
                        new Date(b.addedAt).getTime() -
                        new Date(a.addedAt).getTime()
                )
            case "solved-desc":
                return arr.sort((a, b) => {
                    const av = a.lastSolvedAt
                        ? new Date(a.lastSolvedAt).getTime()
                        : -1
                    const bv = b.lastSolvedAt
                        ? new Date(b.lastSolvedAt).getTime()
                        : -1
                    return bv - av
                })
            case "unsolved-first":
                return arr.sort((a, b) => {
                    const aSolved = a.lastSolvedAt ? 1 : 0
                    const bSolved = b.lastSolvedAt ? 1 : 0
                    if (aSolved !== bSolved) return aSolved - bSolved
                    return a.position - b.position
                })
            case "number":
                return arr.sort((a, b) => a.problem.number - b.problem.number)
            case "manual":
            default:
                return arr
        }
    })()

    function handleRename(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
            const result = await renameList(list.id, {
                name,
                description: description.trim() || undefined,
            })
            if (!result.ok) {
                setError(result.error)
                return
            }
            setEditing(false)
            router.refresh()
        })
    }

    function handleDelete() {
        if (
            !confirm(
                `Delete "${list.name}"? This removes the list but not the problems themselves.`
            )
        ) {
            return
        }
        startTransition(async () => {
            const result = await deleteList(list.id)
            if (!result.ok) {
                setError(result.error)
                return
            }
            router.push("/me/lists")
            router.refresh()
        })
    }

    function move(index: number, delta: -1 | 1) {
        const target = index + delta
        if (target < 0 || target >= items.length) return
        const next = [...items]
        ;[next[index], next[target]] = [next[target], next[index]]
        setItems(next)
        startTransition(async () => {
            const result = await reorderList(
                list.id,
                next.map((i) => i.problemId)
            )
            if (!result.ok) {
                setError(result.error)
                setItems(items)
            }
        })
    }

    function handleRemove(problemSlug: string, problemId: string) {
        const next = items.filter((i) => i.problemId !== problemId)
        setItems(next)
        startTransition(async () => {
            const result = await removeFromList(list.id, problemSlug)
            if (!result.ok) {
                setError(result.error)
                setItems(items)
            }
        })
    }

    function handleDrop(targetId: string) {
        if (!dragId || dragId === targetId) {
            setDragId(null)
            setDragOverId(null)
            return
        }
        const dragIndex = items.findIndex((i) => i.problemId === dragId)
        const targetIndex = items.findIndex((i) => i.problemId === targetId)
        if (dragIndex === -1 || targetIndex === -1) return
        const next = [...items]
        const [moved] = next.splice(dragIndex, 1)
        next.splice(targetIndex, 0, moved)
        setItems(next)
        setDragId(null)
        setDragOverId(null)
        startTransition(async () => {
            const result = await reorderList(
                list.id,
                next.map((i) => i.problemId)
            )
            if (!result.ok) {
                setError(result.error)
                setItems(items)
            }
        })
    }

    return (
        <div className="space-y-6">
            <header className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                    {editing ? (
                        <form onSubmit={handleRename} className="space-y-3 max-w-lg">
                            <Input
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                maxLength={80}
                                required
                                placeholder="List name"
                            />
                            <Input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                maxLength={500}
                                placeholder="Description (optional)"
                            />
                            <div className="flex gap-2">
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={pending || !name.trim()}
                                >
                                    {pending && (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    )}
                                    Save
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setEditing(false)
                                        setName(list.name)
                                        setDescription(list.description ?? "")
                                        setError(null)
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                                {list.name}
                            </h1>
                            {list.description && (
                                <p className="mt-1 text-sm text-muted-foreground max-w-prose">
                                    {list.description}
                                </p>
                            )}
                            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                                {items.length}{" "}
                                {items.length === 1 ? "problem" : "problems"}
                            </p>
                        </>
                    )}
                </div>
                {!editing && (
                    <div className="flex items-center gap-2">
                        <AddProblemsPicker
                            listId={list.id}
                            allProblems={allProblems}
                            existingProblemIds={items.map((i) => i.problemId)}
                            onAdded={(problem, position) => {
                                setItems((prev) => [
                                    ...prev,
                                    {
                                        problemId: problem.id,
                                        position,
                                        addedAt: new Date(),
                                        lastSolvedAt: null,
                                        problem: {
                                            number: problem.number,
                                            slug: problem.slug,
                                            title: problem.title,
                                            difficulty:
                                                problem.difficulty as "EASY" | "MEDIUM" | "HARD",
                                            status: "PUBLISHED",
                                        },
                                    },
                                ])
                                // Refresh to backfill lastSolvedAt if the
                                // problem was already solved before being added.
                                router.refresh()
                            }}
                        />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(true)}
                        >
                            <Pencil className="h-3.5 w-3.5" />
                            Rename
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            disabled={pending}
                            className="text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            Delete
                        </Button>
                    </div>
                )}
            </header>

            {error && (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}

            {items.length === 0 ? (
                <EmptyState
                    title="No problems yet"
                    description="Click 'Add problems' above, or open any problem and use its bookmark button."
                />
            ) : (
                <>
                    <div className="flex items-center justify-between gap-3">
                        <SortMenu value={sortKey} onChange={setSortKey} />
                        {!isManual && (
                            <p className="text-[11px] text-muted-foreground italic">
                                Reorder is disabled while sorted. Switch to
                                Manual to drag.
                            </p>
                        )}
                    </div>
                    <Card className="overflow-hidden">
                        <ul className="divide-y divide-border">
                            {displayItems.map((item, i) => {
                                const solved = Boolean(item.lastSolvedAt)
                                const isDragging = dragId === item.problemId
                                const isDragTarget =
                                    dragOverId === item.problemId &&
                                    dragId !== item.problemId
                                const manualIndex = items.findIndex(
                                    (it) => it.problemId === item.problemId
                                )
                                return (
                                    <li
                                        key={item.problemId}
                                        draggable={isManual && !pending}
                                        onDragStart={(e) => {
                                            if (!isManual) return
                                            setDragId(item.problemId)
                                            e.dataTransfer.effectAllowed = "move"
                                        }}
                                        onDragOver={(e) => {
                                            if (!isManual || !dragId) return
                                            e.preventDefault()
                                            e.dataTransfer.dropEffect = "move"
                                            if (dragOverId !== item.problemId)
                                                setDragOverId(item.problemId)
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverId === item.problemId)
                                                setDragOverId(null)
                                        }}
                                        onDrop={(e) => {
                                            if (!isManual) return
                                            e.preventDefault()
                                            handleDrop(item.problemId)
                                        }}
                                        onDragEnd={() => {
                                            setDragId(null)
                                            setDragOverId(null)
                                        }}
                                        className={cn(
                                            "grid grid-cols-[auto_auto_3rem_1fr_auto_auto] items-center gap-3 px-3 sm:px-5 py-3 transition-colors",
                                            isDragging && "opacity-40",
                                            isDragTarget &&
                                                "bg-primary/5 border-t-2 border-primary"
                                        )}
                                    >
                                        {/* Drag handle (manual only) + arrow fallback */}
                                        <div className="flex items-center gap-1 text-muted-foreground">
                                            {isManual ? (
                                                <span
                                                    aria-hidden
                                                    className="hidden sm:inline-flex h-6 w-4 items-center justify-center cursor-grab active:cursor-grabbing"
                                                    title="Drag to reorder"
                                                >
                                                    <GripVertical className="h-4 w-4" />
                                                </span>
                                            ) : null}
                                            <div className="flex flex-col gap-0.5 sm:hidden">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        move(manualIndex, -1)
                                                    }
                                                    disabled={
                                                        !isManual ||
                                                        manualIndex === 0 ||
                                                        pending
                                                    }
                                                    aria-label="Move up"
                                                    className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    <ArrowUp className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        move(manualIndex, 1)
                                                    }
                                                    disabled={
                                                        !isManual ||
                                                        manualIndex ===
                                                            items.length - 1 ||
                                                        pending
                                                    }
                                                    aria-label="Move down"
                                                    className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                                >
                                                    <ArrowDown className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                        {/* Solved indicator */}
                                        <span
                                            className={cn(
                                                "h-4 w-4 inline-flex items-center justify-center",
                                                solved
                                                    ? "text-easy"
                                                    : "text-muted-foreground/40"
                                            )}
                                            aria-label={
                                                solved ? "Solved" : "Not solved"
                                            }
                                            title={
                                                solved
                                                    ? `Solved ${formatRelative(
                                                          item.lastSolvedAt
                                                      )}`
                                                    : "Not solved yet"
                                            }
                                        >
                                            {solved ? (
                                                <CheckCircle2 className="h-4 w-4" />
                                            ) : (
                                                <Circle className="h-3.5 w-3.5" />
                                            )}
                                        </span>
                                        <span className="text-xs tabular-nums text-muted-foreground">
                                            {item.problem.number}
                                        </span>
                                        <div className="min-w-0">
                                            <Link
                                                href={`/practice/${item.problem.slug}`}
                                                className={cn(
                                                    "font-medium truncate block hover:text-primary transition-colors",
                                                    solved &&
                                                        "text-muted-foreground"
                                                )}
                                            >
                                                {item.problem.title}
                                            </Link>
                                            <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                                                Added{" "}
                                                {formatRelative(item.addedAt)}
                                                {" · "}
                                                {solved ? (
                                                    <span className="text-easy-fg">
                                                        Solved{" "}
                                                        {formatRelative(
                                                            item.lastSolvedAt
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span>Not solved</span>
                                                )}
                                            </p>
                                        </div>
                                        <DifficultyBadge
                                            difficulty={item.problem.difficulty}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleRemove(
                                                    item.problem.slug,
                                                    item.problemId
                                                )
                                            }
                                            disabled={pending}
                                            aria-label="Remove from list"
                                            className="h-7 w-7 inline-flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-50 cursor-pointer"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    </Card>
                </>
            )}
        </div>
    )
}

interface PickerProps {
    listId: string
    allProblems: PickerProblem[]
    existingProblemIds: string[]
    onAdded: (problem: PickerProblem, position: number) => void
}

function AddProblemsPicker({
    listId,
    allProblems,
    existingProblemIds,
    onAdded,
}: PickerProps) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const [adding, setAdding] = useState<Set<string>>(new Set())
    const [error, setError] = useState<string | null>(null)
    const popoverRef = useRef<HTMLDivElement | null>(null)
    const [, startTransition] = useTransition()
    const localExisting = useRef(new Set(existingProblemIds))

    useEffect(() => {
        localExisting.current = new Set(existingProblemIds)
    }, [existingProblemIds])

    useEffect(() => {
        if (!open) return
        function onClick(e: MouseEvent) {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node)
            ) {
                setOpen(false)
            }
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onClick)
        document.addEventListener("keydown", onEsc)
        return () => {
            document.removeEventListener("mousedown", onClick)
            document.removeEventListener("keydown", onEsc)
        }
    }, [open])

    const q = query.trim().toLowerCase()
    const candidates = allProblems
        .filter((p) => !localExisting.current.has(p.id))
        .filter((p) => {
            if (!q) return true
            return (
                p.title.toLowerCase().includes(q) ||
                String(p.number).includes(q) ||
                p.slug.toLowerCase().includes(q)
            )
        })
        .slice(0, 50)

    function handleAdd(p: PickerProblem) {
        if (adding.has(p.id) || localExisting.current.has(p.id)) return
        setAdding((s) => new Set(s).add(p.id))
        setError(null)
        startTransition(async () => {
            const result = await addToList(listId, p.slug)
            setAdding((s) => {
                const next = new Set(s)
                next.delete(p.id)
                return next
            })
            if (!result.ok) {
                setError(result.error)
                return
            }
            localExisting.current.add(p.id)
            // Position is server-managed; the optimistic value is "next slot".
            onAdded(p, localExisting.current.size)
        })
    }

    return (
        <div className="relative" ref={popoverRef}>
            <Button size="sm" onClick={() => setOpen((o) => !o)}>
                <Plus className="h-3.5 w-3.5" />
                Add problems
            </Button>
            {open && (
                <div
                    role="dialog"
                    aria-label="Add problems"
                    className="absolute right-0 top-full mt-2 z-30 w-[22rem] rounded-lg border border-border bg-surface shadow-lg p-2"
                >
                    <div className="relative px-1 py-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search by title, number, or slug…"
                            className="pl-8 h-9 text-sm"
                        />
                    </div>
                    {error && (
                        <p
                            className="px-2 py-1.5 text-[11px] text-destructive"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                    {candidates.length === 0 ? (
                        <p className="px-2 py-4 text-xs text-muted-foreground text-center">
                            {q
                                ? "No matching problems."
                                : "Every problem is already in this list."}
                        </p>
                    ) : (
                        <ul className="max-h-72 overflow-y-auto scrollbar-thin mt-1">
                            {candidates.map((p) => {
                                const isAdding = adding.has(p.id)
                                return (
                                    <li key={p.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleAdd(p)}
                                            disabled={isAdding}
                                            className={cn(
                                                "w-full grid grid-cols-[2.5rem_1fr_auto_1.25rem] items-center gap-2 px-2 py-2 text-sm rounded-md text-left cursor-pointer transition-colors",
                                                "hover:bg-surface-muted disabled:opacity-60"
                                            )}
                                        >
                                            <span className="text-xs tabular-nums text-muted-foreground">
                                                {p.number}
                                            </span>
                                            <span className="truncate">
                                                {p.title}
                                            </span>
                                            <DifficultyBadge
                                                difficulty={p.difficulty}
                                            />
                                            <span className="inline-flex items-center justify-center text-muted-foreground">
                                                {isAdding ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <Plus className="h-3.5 w-3.5" />
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    )
}

function SortMenu({
    value,
    onChange,
}: {
    value: SortKey
    onChange: (k: SortKey) => void
}) {
    const [open, setOpen] = useState(false)
    const ref = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        if (!open) return
        function onClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        function onEsc(e: KeyboardEvent) {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onClick)
        document.addEventListener("keydown", onEsc)
        return () => {
            document.removeEventListener("mousedown", onClick)
            document.removeEventListener("keydown", onEsc)
        }
    }, [open])
    const keys: SortKey[] = [
        "manual",
        "added-desc",
        "solved-desc",
        "unsolved-first",
        "number",
    ]
    return (
        <div className="relative" ref={ref}>
            <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
            >
                <ArrowUpDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sort:</span>{" "}
                {SORT_LABELS[value]}
            </Button>
            {open && (
                <div
                    role="menu"
                    aria-label="Sort"
                    className="absolute left-0 top-full mt-2 z-30 w-56 rounded-lg border border-border bg-surface shadow-lg p-1"
                >
                    {keys.map((k) => (
                        <button
                            key={k}
                            type="button"
                            role="menuitemradio"
                            aria-checked={value === k}
                            onClick={() => {
                                onChange(k)
                                setOpen(false)
                            }}
                            className={cn(
                                "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-surface-muted transition-colors cursor-pointer flex items-center justify-between",
                                value === k && "bg-surface-muted"
                            )}
                        >
                            <span>{SORT_LABELS[k]}</span>
                            {value === k && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
