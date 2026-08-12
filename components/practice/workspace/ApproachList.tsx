"use client"

import { useEffect, useState, useTransition } from "react"
import { BadgeCheck, Loader2, Trash2 } from "lucide-react"
import {
    deleteApproach,
    getApproaches,
    postApproach,
    type ApproachView,
} from "@/actions/approaches"
import { cn } from "@/lib/utils"

interface ApproachListProps {
    slug: string
    isSignedIn: boolean
    /** LOCKED keeps the list readable and removes the composer. */
    locked: boolean
    /** SQL to prefill the composer with, e.g. from "share approach". */
    prefill: string | null
    onPrefillConsumed: () => void
}

/**
 * Community approaches, under the canonical solution.
 *
 * Posting is open to any signed-in user, so the list carries the mitigation
 * for that: approaches whose author has an accepted submission are marked
 * verified, and the rest say plainly that they are not. Verified sorts first
 * only within an equal score — see lib/workspace/approach-sort.ts.
 */
export function ApproachList({
    slug,
    isSignedIn,
    locked,
    prefill,
    onPrefillConsumed,
}: ApproachListProps) {
    const [approaches, setApproaches] = useState<ApproachView[] | null>(null)
    const [sql, setSql] = useState("")
    const [strategy, setStrategy] = useState("")
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    useEffect(() => {
        let cancelled = false
        getApproaches(slug).then((rows) => {
            if (!cancelled) setApproaches(rows)
        })
        return () => {
            cancelled = true
        }
    }, [slug])

    useEffect(() => {
        if (!prefill) return
        setSql(prefill)
        onPrefillConsumed()
    }, [prefill, onPrefillConsumed])

    const mine = approaches?.find((a) => a.isMine) ?? null

    function submit() {
        setError(null)
        startTransition(async () => {
            const result = await postApproach({
                problemSlug: slug,
                sql,
                strategy: strategy || null,
            })
            if (!result.ok) {
                setError(result.reason)
                return
            }
            setSql("")
            setStrategy("")
            setApproaches(await getApproaches(slug))
        })
    }

    function remove(id: string) {
        startTransition(async () => {
            const result = await deleteApproach(id)
            if (!result.ok) {
                setError(result.reason)
                return
            }
            setApproaches(await getApproaches(slug))
        })
    }

    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">Community approaches</h3>
                {approaches && approaches.length > 0 && (
                    <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        {approaches.length}
                    </span>
                )}
            </div>

            {approaches === null ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Loading approaches…
                </div>
            ) : approaches.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                    Nobody has shared an approach yet.
                </p>
            ) : (
                <ul className="space-y-3">
                    {approaches.map((a) => (
                        <li
                            key={a.id}
                            className="overflow-hidden rounded-md border border-border"
                        >
                            <div className="flex items-center gap-2 border-b border-border bg-surface-muted/40 px-3 py-1.5">
                                <span className="truncate text-[12px] font-medium">
                                    {a.authorName}
                                </span>
                                {a.verified ? (
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-medium text-primary"
                                        title="This author has an accepted submission on this problem"
                                    >
                                        <BadgeCheck
                                            className="h-3 w-3"
                                            aria-hidden
                                        />
                                        Verified
                                    </span>
                                ) : null}
                                {a.strategy && (
                                    <span className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                                        {a.strategy}
                                    </span>
                                )}
                                <span className="ml-auto shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                                    {a.score > 0 ? `+${a.score}` : a.score}
                                </span>
                                {a.isMine && (
                                    <button
                                        type="button"
                                        onClick={() => remove(a.id)}
                                        disabled={pending}
                                        aria-label="Delete my approach"
                                        className="text-muted-foreground transition-colors duration-150 hover:text-destructive"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                                    </button>
                                )}
                            </div>
                            <pre className="scrollbar-thin overflow-x-auto px-3 py-2 font-mono text-[12px] leading-relaxed">
                                {a.sql}
                            </pre>
                            {!a.verified && (
                                <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
                                    Not verified against the expected output.
                                </p>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {locked ? (
                <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
                    Sharing is closed for this problem. Existing approaches stay
                    readable.
                </p>
            ) : !isSignedIn ? (
                <p className="text-[12px] text-muted-foreground">
                    Sign in to share your approach.
                </p>
            ) : mine ? (
                <p className="text-[12px] text-muted-foreground">
                    You have shared an approach for this problem.
                </p>
            ) : (
                <div className="space-y-2 rounded-md border border-border p-3">
                    <textarea
                        value={sql}
                        onChange={(e) => setSql(e.target.value)}
                        rows={4}
                        placeholder="Paste the query you want to share…"
                        aria-label="Your approach"
                        className="scrollbar-thin w-full resize-y rounded-md border border-border bg-surface-muted/40 px-2 py-1.5 font-mono text-[12px] focus:border-line-strong focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                        <input
                            value={strategy}
                            onChange={(e) => setStrategy(e.target.value)}
                            placeholder="Strategy (optional)"
                            aria-label="Strategy"
                            maxLength={60}
                            className="min-w-0 flex-1 rounded-md border border-border bg-surface-muted/40 px-2 py-1.5 text-[12px] focus:border-line-strong focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={submit}
                            disabled={pending || sql.trim().length === 0}
                            className={cn(
                                "shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors duration-150",
                                "hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                            )}
                        >
                            {pending ? "Sharing…" : "Share"}
                        </button>
                    </div>
                    {error && (
                        <p className="text-[12px] text-destructive">{error}</p>
                    )}
                </div>
            )}
        </section>
    )
}
