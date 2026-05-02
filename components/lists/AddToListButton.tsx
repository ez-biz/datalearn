"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Bookmark, BookmarkCheck, Check, Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import {
    addToList,
    createList,
    getListIdsContainingProblem,
    getMyLists,
    removeFromList,
    type ListSummary,
} from "@/actions/lists"
import { signInPath } from "@/lib/auth-redirect"
import { cn } from "@/lib/utils"

interface AddToListButtonProps {
    problemSlug: string
    problemId: string
    isSignedIn: boolean
}

export function AddToListButton({
    problemSlug,
    problemId,
    isSignedIn,
}: AddToListButtonProps) {
    const pathname = usePathname()
    const [open, setOpen] = useState(false)
    const [lists, setLists] = useState<ListSummary[] | null>(null)
    const [memberOf, setMemberOf] = useState<Set<string>>(new Set())
    const [creating, setCreating] = useState(false)
    const [newName, setNewName] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const popoverRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        if (!open || !isSignedIn) return
        let cancelled = false
        ;(async () => {
            const [myLists, containing] = await Promise.all([
                getMyLists(),
                getListIdsContainingProblem(problemId),
            ])
            if (cancelled) return
            setLists(myLists)
            setMemberOf(new Set(containing))
        })()
        return () => {
            cancelled = true
        }
    }, [open, isSignedIn, problemId])

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

    function toggle(listId: string) {
        const isMember = memberOf.has(listId)
        // Optimistic flip
        const next = new Set(memberOf)
        if (isMember) next.delete(listId)
        else next.add(listId)
        setMemberOf(next)
        startTransition(async () => {
            const result = isMember
                ? await removeFromList(listId, problemSlug)
                : await addToList(listId, problemSlug)
            if (!result.ok) {
                setError(result.error)
                // Revert
                setMemberOf(memberOf)
            }
        })
    }

    function handleCreate(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
            const created = await createList({ name: newName })
            if (!created.ok) {
                setError(created.error)
                return
            }
            // Auto-add the current problem to the freshly created list
            const added = await addToList(created.data.id, problemSlug)
            if (!added.ok) {
                setError(added.error)
                return
            }
            setNewName("")
            setCreating(false)
            const [myLists, containing] = await Promise.all([
                getMyLists(),
                getListIdsContainingProblem(problemId),
            ])
            setLists(myLists)
            setMemberOf(new Set(containing))
        })
    }

    if (!isSignedIn) {
        return (
            <Link
                href={signInPath(pathname ?? "/practice")}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
                <Bookmark className="h-3 w-3" />
                Save to list
            </Link>
        )
    }

    const isInAny = memberOf.size > 0

    return (
        <div className="relative" ref={popoverRef}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                aria-haspopup="dialog"
                className={cn(
                    "inline-flex items-center gap-1 text-xs transition-colors cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    isInAny
                        ? "text-primary hover:text-primary/80"
                        : "text-muted-foreground hover:text-foreground"
                )}
            >
                {isInAny ? (
                    <BookmarkCheck className="h-3.5 w-3.5" />
                ) : (
                    <Bookmark className="h-3.5 w-3.5" />
                )}
                {isInAny ? "Saved" : "Save"}
            </button>

            {open && (
                <div
                    role="dialog"
                    aria-label="Add to list"
                    className="absolute right-0 top-full mt-2 z-30 w-72 rounded-lg border border-border bg-surface shadow-lg p-2"
                >
                    <div className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Save to list
                    </div>
                    {lists === null ? (
                        <div className="px-2 py-3 text-xs text-muted-foreground inline-flex items-center gap-2">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Loading…
                        </div>
                    ) : lists.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">
                            You don&apos;t have any lists yet. Create one below.
                        </p>
                    ) : (
                        <ul className="max-h-60 overflow-y-auto scrollbar-thin">
                            {lists.map((l) => {
                                const checked = memberOf.has(l.id)
                                return (
                                    <li key={l.id}>
                                        <button
                                            type="button"
                                            onClick={() => toggle(l.id)}
                                            disabled={pending}
                                            className="w-full flex items-center justify-between gap-2 px-2 py-2 text-sm rounded-md hover:bg-surface-muted transition-colors text-left cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                        >
                                            <span className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={cn(
                                                        "h-4 w-4 inline-flex items-center justify-center rounded border shrink-0",
                                                        checked
                                                            ? "bg-primary border-primary text-primary-foreground"
                                                            : "border-border"
                                                    )}
                                                    aria-hidden
                                                >
                                                    {checked && (
                                                        <Check className="h-3 w-3" />
                                                    )}
                                                </span>
                                                <span className="truncate">
                                                    {l.name}
                                                </span>
                                            </span>
                                            <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                                                {l.itemCount}
                                            </span>
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}

                    <div className="border-t border-border mt-2 pt-2">
                        {creating ? (
                            <form onSubmit={handleCreate} className="space-y-2 px-1">
                                <Input
                                    autoFocus
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="New list name"
                                    maxLength={80}
                                    className="h-8 text-xs"
                                    required
                                />
                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={pending || !newName.trim()}
                                    >
                                        {pending && (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        )}
                                        Create + add
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setCreating(false)
                                            setNewName("")
                                            setError(null)
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setCreating(true)}
                                className="w-full flex items-center gap-2 px-2 py-2 text-sm rounded-md hover:bg-surface-muted transition-colors text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                New list
                            </button>
                        )}
                    </div>

                    {error && (
                        <p
                            className="px-2 py-1.5 text-[11px] text-destructive"
                            role="alert"
                        >
                            {error}
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
