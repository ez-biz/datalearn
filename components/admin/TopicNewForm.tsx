"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { slugify } from "@/lib/admin-validation"

export function TopicNewForm() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [slug, setSlug] = useState("")
    const [slugTouched, setSlugTouched] = useState(false)
    const [description, setDescription] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const effectiveSlug = slugTouched ? slug : slugify(name)

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            const res = await fetch("/api/admin/topics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: effectiveSlug,
                    description: description.trim() || null,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to create topic.")
                return
            }
            setName("")
            setSlug("")
            setSlugTouched(false)
            setDescription("")
            router.refresh()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Name" htmlFor="topic-name" required>
                <Input
                    id="topic-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Joins from scratch"
                    required
                />
            </Field>
            <Field label="Slug" htmlFor="topic-slug" required>
                <Input
                    id="topic-slug"
                    value={effectiveSlug}
                    onChange={(e) => {
                        setSlug(e.target.value)
                        setSlugTouched(true)
                    }}
                    placeholder="joins-from-scratch"
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                />
            </Field>
            <div className="flex items-end">
                <Button type="submit" disabled={submitting || !name.trim()}>
                    {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Plus className="h-3.5 w-3.5" />
                    )}
                    Create
                </Button>
            </div>
            <div className="sm:col-span-3">
                <Field label="Description (optional)" htmlFor="topic-desc">
                    <Textarea
                        id="topic-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={2}
                        className="font-sans"
                        placeholder="Short blurb shown on the learn hub card."
                    />
                </Field>
            </div>
            {error && (
                <p className="sm:col-span-3 text-xs text-destructive">{error}</p>
            )}
        </form>
    )
}
