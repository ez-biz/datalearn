"use client"

import { useEffect, useState } from "react"
import { Flag, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Field, Textarea } from "@/components/ui/Input"
import { submitProblemReport } from "@/actions/reports"

const KINDS = [
    { value: "WRONG_ANSWER", label: "Wrong expected answer" },
    { value: "UNCLEAR_DESCRIPTION", label: "Unclear description" },
    { value: "BROKEN_SCHEMA", label: "Schema looks broken" },
    { value: "TYPO", label: "Typo / formatting" },
    { value: "OTHER", label: "Other" },
] as const

type Kind = (typeof KINDS)[number]["value"]

export function ReportDialog({ problemSlug }: { problemSlug: string }) {
    const [open, setOpen] = useState(false)
    const [kind, setKind] = useState<Kind>("WRONG_ANSWER")
    const [message, setMessage] = useState("")
    const [submitting, setSubmitting] = useState(false)
    const [done, setDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : ""
        return () => {
            document.body.style.overflow = ""
        }
    }, [open])

    function reset() {
        setKind("WRONG_ANSWER")
        setMessage("")
        setDone(false)
        setError(null)
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        setError(null)
        if (!message.trim()) {
            setError("Add a short message describing the issue.")
            return
        }
        setSubmitting(true)
        try {
            const res = await submitProblemReport({
                problemSlug,
                kind,
                message: message.trim(),
            })
            if (!res.ok) {
                setError(res.error)
                return
            }
            setDone(true)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
                <Flag className="h-3 w-3" />
                Report a problem
            </button>

            {open && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
                    <div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        onClick={() => {
                            if (!submitting) {
                                setOpen(false)
                                reset()
                            }
                        }}
                        aria-hidden
                    />
                    <div className="relative w-full max-w-md rounded-lg border border-border bg-surface shadow-xl">
                        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                            <h2 className="text-sm font-semibold inline-flex items-center gap-2">
                                <Flag className="h-3.5 w-3.5" />
                                Report a problem
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false)
                                    reset()
                                }}
                                disabled={submitting}
                                className="text-muted-foreground hover:text-foreground cursor-pointer"
                                aria-label="Close"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {done ? (
                            <div className="p-6 text-center">
                                <p className="text-sm font-medium">Thanks — report received.</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    An admin will review it.
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => {
                                        setOpen(false)
                                        reset()
                                    }}
                                >
                                    Close
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="p-5 space-y-4">
                                <Field label="What went wrong?" htmlFor="report-kind" required>
                                    <select
                                        id="report-kind"
                                        value={kind}
                                        onChange={(e) => setKind(e.target.value as Kind)}
                                        className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                        {KINDS.map((k) => (
                                            <option key={k.value} value={k.value}>
                                                {k.label}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                                <Field
                                    label="Details"
                                    htmlFor="report-msg"
                                    description="Be specific — paste the failing query or expected vs actual."
                                    required
                                >
                                    <Textarea
                                        id="report-msg"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        rows={5}
                                        placeholder="The expected output has 'amount' as a string but my correct query returns a number…"
                                        className="font-sans"
                                        required
                                    />
                                </Field>
                                {error && (
                                    <p className="text-xs text-destructive">{error}</p>
                                )}
                                <div className="flex items-center justify-end gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setOpen(false)
                                            reset()
                                        }}
                                        disabled={submitting}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="sm" disabled={submitting}>
                                        {submitting ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : null}
                                        Send report
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
