"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { slugify } from "@/lib/admin-validation"

export function TrackCreateForm() {
    const router = useRouter()
    const [name, setName] = useState("")
    const [slug, setSlug] = useState("")
    const [slugTouched, setSlugTouched] = useState(false)
    const [summary, setSummary] = useState("")
    const [description, setDescription] = useState("")
    const [difficulty, setDifficulty] = useState("MEDIUM")
    const [estimatedMinutes, setEstimatedMinutes] = useState(60)
    const [coverImageUrl, setCoverImageUrl] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const effectiveSlug = slugTouched ? slug : slugify(name)

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault()
        setError(null)
        setSubmitting(true)
        try {
            const res = await fetch("/api/admin/tracks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    slug: effectiveSlug,
                    summary: summary.trim(),
                    description: description.trim(),
                    difficulty,
                    estimatedMinutes,
                    coverImageUrl: coverImageUrl.trim() || null,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to create track.")
                return
            }
            router.push(`/admin/tracks/${json.data.slug}/edit`)
            router.refresh()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <Card>
            <CardContent className="p-5">
                <form onSubmit={onSubmit} className="grid gap-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Name" htmlFor="track-name" required>
                            <Input
                                id="track-name"
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                placeholder="Window Functions Deep Dive"
                                required
                            />
                        </Field>
                        <Field label="Slug" htmlFor="track-slug" required>
                            <Input
                                id="track-slug"
                                value={effectiveSlug}
                                onChange={(event) => {
                                    setSlug(slugify(event.target.value))
                                    setSlugTouched(true)
                                }}
                                placeholder="window-functions-deep-dive"
                                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                required
                            />
                        </Field>
                    </div>
                    <Field label="Summary" htmlFor="track-summary" required>
                        <Input
                            id="track-summary"
                            value={summary}
                            onChange={(event) => setSummary(event.target.value)}
                            maxLength={500}
                            placeholder="A focused sequence for mastering analytic SQL."
                            required
                        />
                    </Field>
                    <Field
                        label="Description"
                        htmlFor="track-description"
                        required
                    >
                        <Textarea
                            id="track-description"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            rows={6}
                            className="font-sans"
                            placeholder="Explain who this track is for and what the learner will practice."
                            required
                        />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Difficulty" htmlFor="track-difficulty">
                            <select
                                id="track-difficulty"
                                value={difficulty}
                                onChange={(event) =>
                                    setDifficulty(event.target.value)
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
                            label="Estimated minutes"
                            htmlFor="track-minutes"
                        >
                            <Input
                                id="track-minutes"
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
                            htmlFor="track-cover"
                            description="Optional for v1."
                        >
                            <Input
                                id="track-cover"
                                type="url"
                                value={coverImageUrl}
                                onChange={(event) =>
                                    setCoverImageUrl(event.target.value)
                                }
                                placeholder="https://..."
                            />
                        </Field>
                    </div>
                    {error ? (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    ) : null}
                    <div>
                        <Button
                            type="submit"
                            disabled={
                                submitting ||
                                !name.trim() ||
                                !summary.trim() ||
                                !description.trim()
                            }
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Plus className="h-4 w-4" />
                            )}
                            Create track
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
