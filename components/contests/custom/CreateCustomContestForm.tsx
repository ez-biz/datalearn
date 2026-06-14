"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Sparkles, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Field, Input } from "@/components/ui/Input"
import { createCustomContest } from "@/actions/custom-contests"
import { istLocalInputToUtc } from "@/lib/time-ist"

type PublishedProblem = { id: string; number: number; title: string }

export function CreateCustomContestForm({
    publishedProblems,
    atCap,
}: {
    publishedProblems: PublishedProblem[]
    atCap: boolean
}) {
    const router = useRouter()
    const [title, setTitle] = useState("")
    const [search, setSearch] = useState("")
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [startsAt, setStartsAt] = useState("")
    const [endsAt, setEndsAt] = useState("")
    const [maxParticipants, setMaxParticipants] = useState("20")
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const byId = useMemo(() => {
        const map = new Map<string, PublishedProblem>()
        for (const p of publishedProblems) map.set(p.id, p)
        return map
    }, [publishedProblems])

    const selectedProblems = useMemo(
        () =>
            selectedIds
                .map((id) => byId.get(id))
                .filter((p): p is PublishedProblem => Boolean(p)),
        [selectedIds, byId]
    )

    const matches = useMemo(() => {
        const query = search.trim().toLowerCase()
        if (!query) return [] as PublishedProblem[]
        return publishedProblems
            .filter((p) => !selectedIds.includes(p.id))
            .filter(
                (p) =>
                    p.title.toLowerCase().includes(query) ||
                    String(p.number).includes(query)
            )
            .slice(0, 8)
    }, [search, publishedProblems, selectedIds])

    function addProblem(id: string) {
        setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        setSearch("")
    }

    function removeProblem(id: string) {
        setSelectedIds((prev) => prev.filter((existing) => existing !== id))
    }

    async function onSubmit(event: React.FormEvent) {
        event.preventDefault()
        if (atCap) return
        setSubmitting(true)
        setError(null)
        try {
            const result = await createCustomContest({
                title: title.trim(),
                problemIds: selectedIds,
                startsAtIso: istLocalInputToUtc(startsAt).toISOString(),
                endsAtIso: istLocalInputToUtc(endsAt).toISOString(),
                maxParticipants: Number(maxParticipants),
            })
            if (!result.ok) {
                setError(result.error)
                return
            }
            router.push(`/contests/custom/${result.slug}`)
        } catch {
            setError("Something went wrong. Try again.")
        } finally {
            setSubmitting(false)
        }
    }

    const canSubmit =
        !atCap &&
        !submitting &&
        title.trim().length > 0 &&
        selectedIds.length > 0 &&
        Boolean(startsAt) &&
        Boolean(endsAt)

    return (
        <Card>
            <CardContent className="p-5">
                <div className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                    Friendly · unrated
                    <span className="text-muted-foreground/70">
                        — casual contests for you and your friends; results
                        don&apos;t affect ratings.
                    </span>
                </div>

                {atCap && (
                    <div
                        className="mb-5 rounded-md border border-border bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground"
                        role="status"
                    >
                        You already have an active custom contest. End it before
                        creating another.
                    </div>
                )}

                <form onSubmit={onSubmit} className="grid gap-4">
                    <Field label="Title" htmlFor="custom-title" required>
                        <Input
                            id="custom-title"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Friday Night SQL"
                            maxLength={80}
                            required
                        />
                    </Field>

                    <Field
                        label="Problems"
                        htmlFor="custom-problem-search"
                        description="Search by number or title, then click to add. Click a chip to remove it."
                        required
                    >
                        <div className="space-y-2">
                            {selectedProblems.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedProblems.map((problem) => (
                                        <button
                                            key={problem.id}
                                            type="button"
                                            onClick={() =>
                                                removeProblem(problem.id)
                                            }
                                            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-muted px-2 py-1 text-xs font-medium text-foreground transition-colors hover:border-border-strong hover:bg-surface-elevated"
                                        >
                                            <span className="tabular-nums text-muted-foreground">
                                                #{problem.number}
                                            </span>
                                            <span className="max-w-[16rem] truncate">
                                                {problem.title}
                                            </span>
                                            <X className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                    ))}
                                </div>
                            )}
                            <div className="relative">
                                <Input
                                    id="custom-problem-search"
                                    value={search}
                                    onChange={(event) =>
                                        setSearch(event.target.value)
                                    }
                                    placeholder="Search published problems…"
                                    autoComplete="off"
                                />
                                {matches.length > 0 && (
                                    <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-md">
                                        {matches.map((problem) => (
                                            <li key={problem.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        addProblem(problem.id)
                                                    }
                                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted"
                                                >
                                                    <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                                    <span className="tabular-nums text-muted-foreground">
                                                        #{problem.number}
                                                    </span>
                                                    <span className="truncate">
                                                        {problem.title}
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground tabular-nums">
                                {selectedIds.length} selected
                            </p>
                        </div>
                    </Field>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                            label="Starts at (IST)"
                            htmlFor="custom-start"
                            required
                        >
                            <Input
                                id="custom-start"
                                type="datetime-local"
                                value={startsAt}
                                onChange={(event) =>
                                    setStartsAt(event.target.value)
                                }
                                required
                            />
                        </Field>
                        <Field
                            label="Ends at (IST)"
                            htmlFor="custom-end"
                            required
                        >
                            <Input
                                id="custom-end"
                                type="datetime-local"
                                value={endsAt}
                                onChange={(event) =>
                                    setEndsAt(event.target.value)
                                }
                                required
                            />
                        </Field>
                    </div>

                    <Field
                        label="Max participants"
                        htmlFor="custom-max"
                        description="Between 1 and 50."
                    >
                        <Input
                            id="custom-max"
                            type="number"
                            min={1}
                            max={50}
                            value={maxParticipants}
                            onChange={(event) =>
                                setMaxParticipants(event.target.value)
                            }
                            className="max-w-[8rem]"
                        />
                    </Field>

                    {error && (
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                    )}

                    <div>
                        <Button type="submit" disabled={!canSubmit}>
                            {submitting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trophy className="h-4 w-4" />
                            )}
                            Create contest
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
