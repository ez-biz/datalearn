"use client"

import type { FormEvent } from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { slugify } from "@/lib/admin-validation"

export function TagCreateForm() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [slug, setSlug] = useState("")
    const [kind, setKind] = useState<"TOPIC" | "COMPANY">("TOPIC")
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function onSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const trimmedName = name.trim()
        const trimmedSlug = slug.trim() || slugify(trimmedName)
        if (!trimmedName || !trimmedSlug) return

        setSaving(true)
        setError(null)
        try {
            const res = await fetch("/api/admin/tags", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: trimmedName,
                    slug: trimmedSlug,
                    kind,
                }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                throw new Error(body?.error ?? "Failed to create tag.")
            }
            setName("")
            setSlug("")
            setKind("TOPIC")
            router.refresh()
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to create tag.",
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            onSubmit={onSubmit}
            className="grid gap-3 rounded-md border border-border bg-surface p-4 sm:grid-cols-[1fr_1fr_10rem_auto]"
        >
            <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                    Name
                </span>
                <Input
                    value={name}
                    onChange={(event) => {
                        setName(event.target.value)
                        if (!slug.trim()) {
                            setSlug(slugify(event.target.value))
                        }
                    }}
                    placeholder="Stripe"
                    required
                />
            </label>
            <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                    Slug
                </span>
                <Input
                    value={slug}
                    onChange={(event) => setSlug(slugify(event.target.value))}
                    placeholder="stripe"
                    required
                />
            </label>
            <label className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">
                    Kind
                </span>
                <select
                    value={kind}
                    onChange={(event) =>
                        setKind(event.target.value as "TOPIC" | "COMPANY")
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <option value="TOPIC">Topic</option>
                    <option value="COMPANY">Company</option>
                </select>
            </label>
            <div className="flex items-end">
                <Button type="submit" disabled={saving || !name.trim()}>
                    <Plus className="h-4 w-4" />
                    {saving ? "Saving" : "Add"}
                </Button>
            </div>
            {error ? (
                <p className="text-sm text-destructive sm:col-span-4">
                    {error}
                </p>
            ) : null}
        </form>
    )
}
