"use client"

import { CheckCircle2, ChevronRight, XCircle } from "lucide-react"
import { useState } from "react"
import type { ValidationResult as VR } from "@/lib/sql-validator"
import { cn } from "@/lib/utils"

interface Props {
    result: VR | null
}

export function ValidationResult({ result }: Props) {
    const [open, setOpen] = useState(false)
    if (!result) return null

    if (result.ok) {
        return (
            <div className="rounded-lg border border-easy/40 bg-easy-bg/50 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-easy-fg">
                    <CheckCircle2 className="h-4 w-4" />
                    Accepted — your output matches the expected result.
                </div>
            </div>
        )
    }

    const hasDetail =
        Boolean(result.diff?.firstMismatch) ||
        Boolean(result.diff?.userKeys && result.diff.expectedKeys)

    return (
        <div className="rounded-lg border border-hard/40 bg-hard-bg/40">
            <div className="flex items-start gap-3 px-4 py-3">
                <XCircle className="h-4 w-4 text-hard-fg mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-hard-fg">
                        Wrong answer
                    </div>
                    <div className="mt-0.5 text-sm text-hard-fg/90">{result.reason}</div>
                </div>
                {hasDetail && (
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        className="text-xs font-medium text-hard-fg hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                        {open ? "Hide" : "Show"} details
                        <ChevronRight
                            className={cn(
                                "h-3 w-3 transition-transform",
                                open && "rotate-90"
                            )}
                        />
                    </button>
                )}
            </div>
            {open && hasDetail && (
                <div className="border-t border-hard/30 px-4 py-3 space-y-3">
                    {result.diff?.userKeys && result.diff.expectedKeys && (
                        <div className="text-xs space-y-1">
                            <div className="text-muted-foreground">Columns</div>
                            <div className="font-mono">
                                <span className="text-muted-foreground">your: </span>
                                <span className="text-foreground">
                                    [{result.diff.userKeys.join(", ")}]
                                </span>
                            </div>
                            <div className="font-mono">
                                <span className="text-muted-foreground">expected: </span>
                                <span className="text-foreground">
                                    [{result.diff.expectedKeys.join(", ")}]
                                </span>
                            </div>
                        </div>
                    )}
                    {result.diff?.firstMismatch && (
                        <div>
                            <div className="text-xs text-muted-foreground mb-1.5">
                                Row {result.diff.firstMismatch.index + 1} mismatch
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2 text-xs">
                                <DiffPane label="Your row">
                                    {JSON.stringify(result.diff.firstMismatch.user, null, 2)}
                                </DiffPane>
                                <DiffPane label="Expected">
                                    {JSON.stringify(result.diff.firstMismatch.expected, null, 2)}
                                </DiffPane>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function DiffPane({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1">
                {label}
            </div>
            <pre className="overflow-auto rounded-md border border-border bg-surface p-2.5 font-mono text-foreground scrollbar-thin">
                {children}
            </pre>
        </div>
    )
}
