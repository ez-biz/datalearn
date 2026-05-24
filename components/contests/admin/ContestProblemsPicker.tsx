"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { Badge, DifficultyBadge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { Card, CardContent } from "@/components/ui/Card"
import { Field, Input } from "@/components/ui/Input"

type Attached = {
    problemId: string
    position: number
    points: number
    problem: {
        id: string
        number: number
        slug: string
        title: string
        difficulty: string
    }
}

type ProblemOption = {
    id: string
    number: number
    slug: string
    title: string
    difficulty: string
}

export function ContestProblemsPicker({
    contestId,
    attached,
    allProblems,
}: {
    contestId: string
    attached: Attached[]
    allProblems: ProblemOption[]
}) {
    const router = useRouter()
    const [problemId, setProblemId] = useState("")
    const [position, setPosition] = useState(
        String((attached.at(-1)?.position ?? 0) + 1)
    )
    const [points, setPoints] = useState("3")
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const attachedIds = useMemo(
        () => new Set(attached.map((item) => item.problemId)),
        [attached]
    )
    const options = allProblems.filter((problem) => !attachedIds.has(problem.id))

    async function attach(event: React.FormEvent) {
        event.preventDefault()
        if (!problemId) return
        setPending(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/contests/${contestId}/problems`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    problemId,
                    position: Number(position),
                    points: Number(points),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to attach problem.")
                return
            }
            setProblemId("")
            setPosition(String(Number(position) + 1))
            router.refresh()
        } finally {
            setPending(false)
        }
    }

    async function detach(targetProblemId: string) {
        setPending(true)
        setError(null)
        try {
            const res = await fetch(
                `/api/admin/contests/${contestId}/problems/${targetProblemId}`,
                { method: "DELETE" }
            )
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error ?? "Failed to detach problem.")
                return
            }
            router.refresh()
        } finally {
            setPending(false)
        }
    }

    return (
        <Card>
            <CardContent className="space-y-5 p-5">
                <div>
                    <h2 className="text-base font-semibold">Problems</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Attached official-contest problems are locked out of the
                        public practice list until the contest ends.
                    </p>
                </div>
                <form onSubmit={attach} className="grid gap-3 sm:grid-cols-[1fr_5rem_5rem_auto]">
                    <Field label="Problem" htmlFor="contest-problem">
                        <select
                            id="contest-problem"
                            value={problemId}
                            onChange={(event) => setProblemId(event.target.value)}
                            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <option value="">Select problem</option>
                            {options.map((problem) => (
                                <option key={problem.id} value={problem.id}>
                                    #{problem.number} {problem.title}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label="Pos" htmlFor="contest-position">
                        <Input
                            id="contest-position"
                            type="number"
                            min={1}
                            max={20}
                            value={position}
                            onChange={(event) => setPosition(event.target.value)}
                        />
                    </Field>
                    <Field label="Pts" htmlFor="contest-points">
                        <Input
                            id="contest-points"
                            type="number"
                            min={1}
                            max={20}
                            value={points}
                            onChange={(event) => setPoints(event.target.value)}
                        />
                    </Field>
                    <div className="self-end">
                        <Button
                            type="submit"
                            size="sm"
                            disabled={pending || !problemId}
                        >
                            {pending ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                <Plus className="h-3.5 w-3.5" />
                            )}
                            Attach
                        </Button>
                    </div>
                </form>
                {error && (
                    <p className="text-sm text-destructive" role="alert">
                        {error}
                    </p>
                )}
                <ul className="divide-y divide-border rounded-md border border-border">
                    {attached.length === 0 ? (
                        <li className="p-4 text-sm text-muted-foreground">
                            No problems attached.
                        </li>
                    ) : (
                        attached.map((item) => (
                            <li
                                key={item.problemId}
                                className="flex items-center gap-3 px-4 py-3"
                            >
                                <span className="font-mono text-xs text-muted-foreground">
                                    {item.position}
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium">
                                        #{item.problem.number}{" "}
                                        {item.problem.title}
                                    </p>
                                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                                        /practice/{item.problem.slug}
                                    </p>
                                </div>
                                <Badge variant="outline">
                                    {item.points} pts
                                </Badge>
                                <DifficultyBadge
                                    difficulty={item.problem.difficulty}
                                />
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={pending}
                                    aria-label="Detach problem"
                                    onClick={() => detach(item.problemId)}
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </li>
                        ))
                    )}
                </ul>
            </CardContent>
        </Card>
    )
}
