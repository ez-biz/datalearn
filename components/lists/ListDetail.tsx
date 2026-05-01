"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
    ArrowDown,
    ArrowUp,
    Loader2,
    Pencil,
    Trash2,
    X,
} from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { DifficultyBadge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"
import {
    deleteList,
    removeFromList,
    renameList,
    reorderList,
    type ListWithItems,
} from "@/actions/lists"

export function ListDetail({ list }: { list: ListWithItems }) {
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
                    description="Open a problem and use the bookmark button to add it to this list."
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
