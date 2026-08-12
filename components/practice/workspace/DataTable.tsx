"use client"

import { cn } from "@/lib/utils"

/**
 * Sample-row and expected-output tables for the description tab.
 *
 * Lifted verbatim out of ProblemPanel.tsx during the SP5 split — the value
 * rendering here is load-bearing and easy to regress: bigint must be
 * stringified (JSON.stringify throws on it), objects must be JSON-encoded
 * rather than rendered as "[object Object]", and NULL is shown explicitly
 * so an empty cell is never ambiguous.
 */
export function DataTable({
    columns,
    rows,
}: {
    columns: string[]
    rows: Record<string, unknown>[]
}) {
    if (columns.length === 0) {
        return null
    }
    if (rows.length === 0) {
        return (
            <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-[12px]">
                    <thead className="bg-surface-muted">
                        <tr>
                            {columns.map((c) => (
                                <th
                                    key={c}
                                    className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide"
                                >
                                    {c}
                                </th>
                            ))}
                        </tr>
                    </thead>
                </table>
                <p className="px-3 py-3 text-[11px] text-muted-foreground italic border-t border-border">
                    No rows.
                </p>
            </div>
        )
    }
    return (
        <div className="rounded-md border border-border overflow-x-auto scrollbar-thin">
            <table className="w-full text-[12px]">
                <thead className="bg-surface-muted">
                    <tr>
                        {columns.map((c) => (
                            <th
                                key={c}
                                className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                            >
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-mono">
                    {rows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                            {columns.map((c) => {
                                const v = row[c]
                                const isNumeric =
                                    typeof v === "number" || typeof v === "bigint"
                                return (
                                    <td
                                        key={c}
                                        className={cn(
                                            "px-3 py-1.5 text-foreground/90 whitespace-nowrap",
                                            isNumeric && "tabular-nums text-right"
                                        )}
                                    >
                                        {v === null || v === undefined ? (
                                            <span className="text-muted-foreground/60 italic font-sans">
                                                NULL
                                            </span>
                                        ) : typeof v === "bigint" ? (
                                            String(v)
                                        ) : typeof v === "object" ? (
                                            JSON.stringify(v)
                                        ) : (
                                            String(v)
                                        )}
                                    </td>
                                )
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function ColumnSchemaTable({
    columns,
}: {
    columns: { name: string; type: string }[]
}) {
    if (columns.length === 0) {
        return (
            <p className="px-3 py-2 text-xs text-muted-foreground italic">
                Schema unavailable.
            </p>
        )
    }
    return (
        <table className="w-full text-[12px]">
            <thead className="bg-surface-muted/50">
                <tr>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Column Name
                    </th>
                    <th className="px-3 py-1.5 text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                        Type
                    </th>
                </tr>
            </thead>
            <tbody className="font-mono">
                {columns.map((c) => (
                    <tr key={c.name} className="border-t border-border">
                        <td className="px-3 py-1.5 text-foreground">{c.name}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">
                            {c.type.toLowerCase()}
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
    )
}
