"use client"

import { AlertCircle, Loader2, Table2 } from "lucide-react"

interface ResultTableProps {
    data: any[]
    error?: string | null
    loading?: boolean
}

export function ResultTable({ data, error, loading }: ResultTableProps) {
    if (loading) {
        return (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground bg-surface">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running query…
            </div>
        )
    }

    if (error) {
        return (
            <div className="h-full p-4 overflow-auto bg-destructive/5 text-destructive font-mono text-[13px] leading-relaxed scrollbar-thin">
                <div className="flex items-center gap-2 mb-2 font-sans font-semibold text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Query error
                </div>
                <pre className="whitespace-pre-wrap break-words">{error}</pre>
            </div>
        )
    }

    if (!data || data.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-surface">
                <Table2 className="h-6 w-6 mb-2 opacity-50" />
                <p className="text-sm">No results yet</p>
                <p className="text-xs mt-1">Run a query to see output here.</p>
            </div>
        )
    }

    const columns = Object.keys(data[0])
    const isNumeric = (v: any) =>
        typeof v === "number" || (typeof v === "bigint")

    return (
        <div className="h-full overflow-auto bg-surface scrollbar-thin">
            <table className="min-w-full text-[13px]">
                <thead className="sticky top-0 z-10 bg-surface-muted/95 backdrop-blur">
                    <tr>
                        {columns.map((col) => (
                            <th
                                key={col}
                                className="px-4 py-2.5 text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wide border-b border-border whitespace-nowrap"
                            >
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="font-mono">
                    {data.map((row, i) => (
                        <tr
                            key={i}
                            className="border-b border-border last:border-0 hover:bg-surface-muted/50"
                        >
                            {columns.map((col) => {
                                const v = row[col]
                                return (
                                    <td
                                        key={`${i}-${col}`}
                                        className={`px-4 py-2 whitespace-nowrap text-foreground/90 ${isNumeric(v) ? "tabular-nums text-right" : ""}`}
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
