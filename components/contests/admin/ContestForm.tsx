"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Field, Input, Textarea } from "@/components/ui/Input"
import { slugify } from "@/lib/admin-validation"

type ContestKind = "WEEKLY" | "BIWEEKLY" | "SPECIAL"

export function ContestForm({
    mode,
}: {
    mode:
        | { kind: "create" }
        | {
              kind: "edit"
              id: string
              initial: {
                  slug: string
                  title: string
                  description: string
                  kind: ContestKind
                  startsAt: string
                  endsAt: string
                  rated: boolean
                  maxParticipants: number | null
              }
          }
}) {
    const router = useRouter()
    const initial =
        mode.kind === "edit"
            ? mode.initial
            : {
                  slug: "",
                  title: "",
                  description: "",
                  kind: "WEEKLY" as ContestKind,
                  startsAt: "",
                  endsAt: "",
                  rated: false,
                  maxParticipants: null,
              }
    const [title, setTitle] = useState(initial.title)
    const [slug, setSlug] = useState(initial.slug)
    const [slugTouched, setSlugTouched] = useState(mode.kind === "edit")
    const [description, setDescription] = useState(initial.description)
    const [kind, setKind] = useState<ContestKind>(initial.kind)
    const [startsAt, setStartsAt] = useState(initial.startsAt)
    const [endsAt, setEndsAt] = useState(initial.endsAt)
    const [rated, setRated] = useState(initial.rated)
    const [maxParticipants, setMaxParticipants] = useState(
        initial.maxParticipants?.toString() ?? ""
    )
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const effectiveSlug = useMemo(
        () => (slugTouched ? slug : slugify(title)),
        [slug, slugTouched, title]
    )

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault()
        setSubmitting(true)
        setError(null)
        try {
            const payload: Record<string, unknown> = {
                title: title.trim(),
                description: description.trim(),
                startsAt: new Date(startsAt).toISOString(),
                endsAt: new Date(endsAt).toISOString(),
                rated,
                maxParticipants: maxParticipants
                    ? Number(maxParticipants)
                    : null,
            }
            if (mode.kind === "create") {
                payload.slug = effectiveSlug
                payload.kind = kind
            }
            const res = await fetch(
                mode.kind === "create"
                    ? "/api/admin/contests"
                    : `/api/admin/contests/${mode.id}`,
                {
                    method: mode.kind === "create" ? "POST" : "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                }
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to save contest.")
                return
            }
            router.push(`/admin/contests/${json.data.id}`)
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
                        <Field label="Title" htmlFor="contest-title" required>
                            <Input
                                id="contest-title"
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                required
                            />
                        </Field>
                        <Field label="Slug" htmlFor="contest-slug" required>
                            <Input
                                id="contest-slug"
                                value={effectiveSlug}
                                onChange={(event) => {
                                    setSlug(slugify(event.target.value))
                                    setSlugTouched(true)
                                }}
                                disabled={mode.kind === "edit"}
                                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                                required
                            />
                        </Field>
                    </div>
                    <Field label="Description" htmlFor="contest-description" required>
                        <Textarea
                            id="contest-description"
                            value={description}
                            onChange={(event) =>
                                setDescription(event.target.value)
                            }
                            rows={5}
                            className="font-sans"
                            required
                        />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Kind" htmlFor="contest-kind">
                            <select
                                id="contest-kind"
                                value={kind}
                                disabled={mode.kind === "edit"}
                                onChange={(event) =>
                                    setKind(event.target.value as ContestKind)
                                }
                                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                <option value="WEEKLY">Weekly</option>
                                <option value="BIWEEKLY">Biweekly</option>
                                <option value="SPECIAL">Special</option>
                            </select>
                        </Field>
                        <Field label="Starts at" htmlFor="contest-start" required>
                            <Input
                                id="contest-start"
                                type="datetime-local"
                                value={startsAt}
                                onChange={(event) =>
                                    setStartsAt(event.target.value)
                                }
                                required
                            />
                        </Field>
                        <Field label="Ends at" htmlFor="contest-end" required>
                            <Input
                                id="contest-end"
                                type="datetime-local"
                                value={endsAt}
                                onChange={(event) =>
                                    setEndsAt(event.target.value)
                                }
                                required
                            />
                        </Field>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Max participants" htmlFor="contest-max">
                            <Input
                                id="contest-max"
                                type="number"
                                min={1}
                                value={maxParticipants}
                                onChange={(event) =>
                                    setMaxParticipants(event.target.value)
                                }
                                placeholder="No cap"
                            />
                        </Field>
                        <label className="flex items-center gap-2 self-end rounded-md border border-border bg-surface px-3 py-2 text-sm">
                            <input
                                type="checkbox"
                                checked={rated}
                                onChange={(event) =>
                                    setRated(event.target.checked)
                                }
                            />
                            Rated contest
                        </label>
                    </div>
                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}
                    <div>
                        <Button
                            type="submit"
                            disabled={
                                submitting ||
                                !title.trim() ||
                                !description.trim() ||
                                !startsAt ||
                                !endsAt
                            }
                        >
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {mode.kind === "create" ? "Create contest" : "Save contest"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
