"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { createList } from "@/actions/lists"

export function CreateListButton({ size = "md" }: { size?: "sm" | "md" }) {
    const [open, setOpen] = useState(false)
    const [name, setName] = useState("")
    const [description, setDescription] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()
    const router = useRouter()
    const popoverRef = useRef<HTMLDivElement | null>(null)

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

    function reset() {
        setName("")
        setDescription("")
        setError(null)
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        startTransition(async () => {
            const result = await createList({
                name,
                description: description.trim() || undefined,
            })
            if (!result.ok) {
                setError(result.error)
                return
            }
            setOpen(false)
            reset()
            router.push(`/me/lists/${result.data.id}`)
        })
    }

    return (
        <div className="relative" ref={popoverRef}>
            <Button size={size} onClick={() => setOpen((o) => !o)}>
                <Plus className="h-4 w-4" />
                New list
            </Button>
            {open && (
                <form
                    onSubmit={handleSubmit}
                    role="dialog"
                    aria-label="Create list"
                    className="absolute right-0 top-full mt-2 z-30 w-80 rounded-lg border border-border bg-surface p-4 shadow-lg space-y-3"
                >
                    <div className="space-y-1.5">
                        <label
                            htmlFor="list-name"
                            className="text-xs font-medium text-muted-foreground"
                        >
                            Name
                        </label>
                        <Input
                            id="list-name"
                            autoFocus
                            placeholder="e.g. Window functions to redo"
                            value={name}
                            maxLength={80}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label
                            htmlFor="list-description"
                            className="text-xs font-medium text-muted-foreground"
                        >
                            Description{" "}
                            <span className="text-muted-foreground/70">
                                (optional)
                            </span>
                        </label>
                        <Input
                            id="list-description"
                            placeholder="Why these problems belong together"
                            value={description}
                            maxLength={500}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </div>
                    {error && (
                        <p className="text-xs text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setOpen(false)
                                reset()
                            }}
                            disabled={pending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={pending || !name.trim()}
                        >
                            {pending && (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            )}
                            Create
                        </Button>
                    </div>
                </form>
            )}
        </div>
    )
}
