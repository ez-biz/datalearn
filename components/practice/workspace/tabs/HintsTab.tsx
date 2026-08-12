"use client"

import { useState } from "react"
import { Lightbulb } from "lucide-react"

/**
 * Progressive hint reveal.
 *
 * Semantics are preserved exactly from the pre-SP5 panel: ordered,
 * cumulative, one button per reveal, and "All hints revealed." when
 * exhausted. The only addition is the preamble, which states plainly that
 * revealing a hint costs nothing — without it learners ration hints against
 * an imagined penalty.
 */
export function HintsTab({ hints }: { hints: string[] }) {
    const [revealed, setRevealed] = useState(0)

    return (
        <div className="space-y-3 p-5">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
                Hints are free. Revealing one changes nothing about your
                verdict, your streak or your progress.
            </p>

            {hints.slice(0, revealed).map((hint, i) => (
                <div
                    key={i}
                    className="rounded-md border-l-2 border-primary bg-surface-muted/40 px-3 py-2.5"
                >
                    <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-primary">
                        Hint {i + 1}
                    </div>
                    <p className="text-[14.5px] leading-relaxed">{hint}</p>
                </div>
            ))}

            {revealed < hints.length ? (
                <button
                    type="button"
                    onClick={() => setRevealed((r) => r + 1)}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface-muted/40 px-3 py-3 text-sm font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground"
                >
                    <Lightbulb className="h-4 w-4" aria-hidden />
                    Reveal hint {revealed + 1} of {hints.length}
                </button>
            ) : (
                <p className="pt-2 text-center text-xs italic text-muted-foreground">
                    All hints revealed.
                </p>
            )}
        </div>
    )
}
