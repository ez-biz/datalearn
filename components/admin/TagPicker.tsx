"use client"

import { useEffect, useState } from "react"
import { Plus, X } from "lucide-react"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { slugify } from "@/lib/admin-validation"

interface Tag {
    id: string
    name: string
    slug: string
}

interface TagPickerProps {
    value: string[]
    onChange: (next: string[]) => void
}

export function TagPicker({ value, onChange }: TagPickerProps) {
    const [available, setAvailable] = useState<Tag[]>([])
    const [loading, setLoading] = useState(true)
    const [draft, setDraft] = useState("")

    useEffect(() => {
        ;(async () => {
            try {
                const res = await fetch("/api/admin/tags")
                if (res.ok) {
                    const json = await res.json()
                    setAvailable(json.data ?? [])
                }
            } finally {
                setLoading(false)
            }
        })()
    }, [])

    function toggle(slug: string) {
        if (value.includes(slug)) {
            onChange(value.filter((s) => s !== slug))
        } else {
            onChange([...value, slug])
        }
    }

    async function addNew() {
        const name = draft.trim()
        if (!name) return
        const slug = slugify(name)
        if (!slug) return
        if (value.includes(slug)) {
            setDraft("")
            return
        }
        // Optimistic — also persist to server so it shows up next time
        if (!available.find((t) => t.slug === slug)) {
            try {
                const res = await fetch("/api/admin/tags", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, slug }),
                })
                if (res.ok) {
                    const { data } = await res.json()
                    setAvailable((cur) => [...cur, data].sort((a, b) =>
                        a.name.localeCompare(b.name)
                    ))
                }
            } catch {
                /* still allow inclusion locally; create-on-fly happens server-side at submit time */
            }
        }
        onChange([...value, slug])
        setDraft("")
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {value.length === 0 && (
                    <span className="text-xs text-muted-foreground italic self-center">
                        No tags selected.
                    </span>
                )}
                {value.map((slug) => (
                    <button
                        type="button"
                        key={slug}
                        onClick={() => toggle(slug)}
                        className="cursor-pointer"
                    >
                        <Badge variant="primary" className="normal-case tracking-normal">
                            {slug}
                            <X className="h-3 w-3" />
                        </Badge>
                    </button>
                ))}
            </div>

            <div className="flex gap-2">
                <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault()
                            addNew()
                        }
                    }}
                    placeholder="Add tag (Enter)…"
                    className="text-sm"
                />
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addNew}
                    disabled={!draft.trim()}
                >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                </Button>
            </div>

            {!loading && available.length > 0 && (
                <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                        Existing tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {available
                            .filter((t) => !value.includes(t.slug))
                            .map((t) => (
                                <button
                                    type="button"
                                    key={t.id}
                                    onClick={() => toggle(t.slug)}
                                    className="cursor-pointer"
                                >
                                    <Badge variant="secondary">{t.slug}</Badge>
                                </button>
                            ))}
                    </div>
                </div>
            )}
        </div>
    )
}
