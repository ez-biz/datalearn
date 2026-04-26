"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Check, Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { Card, CardContent } from "@/components/ui/Card"

export interface TopicInitial {
    name: string
    slug: string
    description: string
}

export function TopicEditForm({
    originalSlug,
    initial,
}: {
    originalSlug: string
    initial: TopicInitial
}) {
    const router = useRouter()
    const [name, setName] = useState(initial.name)
    const [slug, setSlug] = useState(initial.slug)
    const [description, setDescription] = useState(initial.description)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [savedAt, setSavedAt] = useState<number | null>(null)

    useEffect(() => {
        if (savedAt == null) return
        const t = setTimeout(() => setSavedAt(null), 3000)
        return () => clearTimeout(t)
    }, [savedAt])

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            const res = await fetch(`/api/admin/topics/${originalSlug}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    slug,
                    description: description.trim() || null,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? `Request failed: ${res.status}`)
                return
            }
            const newSlug = json?.data?.slug ?? slug
            if (newSlug !== originalSlug) {
                router.push(`/admin/topics/${newSlug}/edit`)
            }
            setSavedAt(Date.now())
            router.refresh()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <form onSubmit={onSubmit}>
            <Card>
                <CardContent className="p-5 space-y-4">
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                    <div className="grid sm:grid-cols-2 gap-4">
                        <Field label="Name" htmlFor="topic-name" required>
                            <Input
                                id="topic-name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required
                            />
                        </Field>
                        <Field label="Slug" htmlFor="topic-slug" required>
                            <Input
                                id="topic-slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                required
                            />
                        </Field>
                    </div>
                    <Field label="Description" htmlFor="topic-desc">
                        <Textarea
                            id="topic-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="font-sans"
                        />
                    </Field>
                </CardContent>
            </Card>
            <div className="mt-4 flex items-center gap-3">
                <Button type="submit" disabled={submitting}>
                    {submitting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Save className="h-3.5 w-3.5" />
                    )}
                    Save changes
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => router.push("/admin/topics")}
                    disabled={submitting}
                >
                    Cancel
                </Button>
                {savedAt && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-easy">
                        <Check className="h-3.5 w-3.5" />
                        Saved
                    </span>
                )}
            </div>
        </form>
    )
}
