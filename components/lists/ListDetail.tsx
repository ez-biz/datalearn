"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowDown,
    ArrowUp,
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
                <Card className="overflow-hidden">
                    <ul className="divide-y divide-border">
                        {items.map((item, i) => (
                            <li
                                key={item.problemId}
                                className="grid grid-cols-[auto_3rem_1fr_auto_auto] items-center gap-3 px-4 sm:px-5 py-3"
                            >
                                <div className="flex flex-col gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() => move(i, -1)}
                                        disabled={i === 0 || pending}
                                        aria-label="Move up"
                                        className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <ArrowUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(i, 1)}
                                        disabled={i === items.length - 1 || pending}
                                        aria-label="Move down"
                                        className="h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                    >
                                        <ArrowDown className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                                <span className="text-xs tabular-nums text-muted-foreground">
                                    {item.problem.number}
                                </span>
                                <Link
                                    href={`/practice/${item.problem.slug}`}
                                    className="font-medium truncate hover:text-primary transition-colors"
                                >
                                    {item.problem.title}
                                </Link>
                                <DifficultyBadge difficulty={item.problem.difficulty} />
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
                        ))}
                    </ul>
                </Card>
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
