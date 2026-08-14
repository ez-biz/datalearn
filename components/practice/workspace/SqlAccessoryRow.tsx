"use client"

import { cn } from "@/lib/utils"

interface Chip {
    label: string
    /** What actually lands in the editor — keywords get a trailing space so
     *  typing continues without the learner adding one themselves; the two
     *  parens and `*` don't, since a space after `(` or before `)` is rarely
     *  what's wanted and `*` is usually followed immediately by more text. */
    insertText: string
}

const CHIPS: Chip[] = [
    { label: "SELECT", insertText: "SELECT " },
    { label: "FROM", insertText: "FROM " },
    { label: "WHERE", insertText: "WHERE " },
    { label: "OVER", insertText: "OVER " },
    { label: "PARTITION BY", insertText: "PARTITION BY " },
    { label: "ORDER BY", insertText: "ORDER BY " },
    { label: "(", insertText: "(" },
    { label: ")", insertText: ")" },
    { label: ",", insertText: ", " },
    { label: "*", insertText: "*" },
]

interface SqlAccessoryRowProps {
    onInsert: (text: string) => void
    className?: string
}

/**
 * A row of common SQL tokens, inserted at the editor's cursor on tap.
 *
 * Mobile-only: a phone's on-screen keyboard has no shortcut row, so typing
 * `PARTITION BY` or reaching a bare `*` means hunting across keyboard modes.
 * Positioned above the action bar and below the editor — not a scrolling
 * sibling of either, so there is no ancestor for a real `position: sticky`
 * to stick within; it simply never moves, which is the same end result.
 */
export function SqlAccessoryRow({ onInsert, className }: SqlAccessoryRowProps) {
    return (
        <div
            role="toolbar"
            aria-label="Insert SQL token"
            className={cn(
                "scrollbar-thin flex h-9 shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border bg-surface-muted px-2",
                className
            )}
        >
            {CHIPS.map((chip) => (
                <button
                    key={chip.label}
                    type="button"
                    onClick={() => onInsert(chip.insertText)}
                    className="inline-flex h-9 shrink-0 items-center justify-center whitespace-nowrap rounded-md px-2.5 font-mono text-xs text-foreground/90 transition-colors duration-150 hover:bg-surface-hover active:scale-[0.96]"
                >
                    {chip.label}
                </button>
            ))}
        </div>
    )
}
