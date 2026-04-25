"use client"

import { useState } from "react"
import {
    CheckCircle2,
    Database,
    FileText,
    History as HistoryIcon,
    Lightbulb,
    Loader2,
} from "lucide-react"
import { DifficultyBadge, Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { HistoryPanel } from "./HistoryPanel"
import type { ProblemHistoryEntry } from "@/actions/submissions"

type Tab = "description" | "schema" | "hints" | "history"

export type TableInfo = {
    name: string
    columns: { name: string; type: string }[]
    sampleRows: Record<string, unknown>[]
}

interface ProblemPanelProps {
    title: string
    difficulty: string
    description: string | null
    schemaDescription: string | null
    schemaSql: string | null
    hints: string[]
    tableInfos: TableInfo[] | null
    tablesLoading: boolean
    expectedRows: Record<string, unknown>[] | null
    expectedColumns: string[] | null
    history: ProblemHistoryEntry[]
    isSolved: boolean
    onLoadCode: (code: string) => void
}

export function ProblemPanel({
    title,
    difficulty,
    description,
    schemaDescription,
    schemaSql,
    hints,
    tableInfos,
    tablesLoading,
    expectedRows,
    expectedColumns,
    history,
    isSolved,
    onLoadCode,
}: ProblemPanelProps) {
    const [tab, setTab] = useState<Tab>("description")
    const hasHints = hints.length > 0

    return (
        <div className="h-full flex flex-col bg-surface">
            <div className="border-b border-border px-5 pt-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-semibold tracking-tight leading-tight">
                        {title}
                    </h1>
                    <div className="flex items-center gap-2 shrink-0">
                        <DifficultyBadge difficulty={difficulty} />
                        {isSolved && (
                            <Badge
                                variant="primary"
                                className="normal-case tracking-normal"
                            >
                                <CheckCircle2 className="h-3 w-3" />
                                Solved
                            </Badge>
                        )}
                    </div>
                </div>
            </div>
            <div className="border-b border-border px-2 overflow-x-auto scrollbar-thin">
                <div className="flex gap-1">
                    <TabBtn
                        active={tab === "description"}
                        onClick={() => setTab("description")}
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label="Description"
                    />
                    <TabBtn
                        active={tab === "schema"}
                        onClick={() => setTab("schema")}
                        icon={<Database className="h-3.5 w-3.5" />}
                        label="Schema"
                    />
                    {hasHints && (
                        <TabBtn
                            active={tab === "hints"}
                            onClick={() => setTab("hints")}
                            icon={<Lightbulb className="h-3.5 w-3.5" />}
                            label="Hints"
                            count={hints.length}
                        />
                    )}
                    <TabBtn
                        active={tab === "history"}
                        onClick={() => setTab("history")}
                        icon={<HistoryIcon className="h-3.5 w-3.5" />}
                        label="History"
                        count={history.length || undefined}
                    />
                </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {tab === "description" && (
                    <DescriptionTab
                        description={description}
                        schemaDescription={schemaDescription}
                        tableInfos={tableInfos}
                        tablesLoading={tablesLoading}
                        expectedRows={expectedRows}
                        expectedColumns={expectedColumns}
                    />
                )}
                {tab === "schema" && (
                    <SchemaTab
                        schemaDescription={schemaDescription}
                        schemaSql={schemaSql}
                    />
                )}
                {tab === "hints" && hasHints && <HintsTab hints={hints} />}
                {tab === "history" && (
                    <HistoryPanel history={history} onLoadCode={onLoadCode} />
                )}
            </div>
        </div>
    )
}

function DescriptionTab({
    description,
    schemaDescription,
    tableInfos,
    tablesLoading,
    expectedRows,
    expectedColumns,
}: {
    description: string | null
    schemaDescription: string | null
    tableInfos: TableInfo[] | null
    tablesLoading: boolean
    expectedRows: Record<string, unknown>[] | null
    expectedColumns: string[] | null
}) {
    const hasInputTables = tableInfos && tableInfos.length > 0
    const hasOutput =
        expectedColumns &&
        expectedColumns.length > 0 &&
        expectedRows &&
        expectedRows.length > 0

    return (
        <div className="p-5 space-y-7">
            {/* Schema overview — column-name/type tables, LeetCode-style */}
            {tablesLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading schema…
                </div>
            ) : hasInputTables ? (
                <section className="space-y-4">
                    {tableInfos!.map((t) => (
                        <div key={t.name}>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-medium">Table:</span>
                                <code className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px] font-mono">
                                    {t.name}
                                </code>
                            </div>
                            <ColumnSchemaTable columns={t.columns} />
                        </div>
                    ))}
                </section>
            ) : null}

            {/* Problem prose */}
            {description && (
                <section className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none">
                    <p className="whitespace-pre-wrap">{description}</p>
                </section>
            )}

            {schemaDescription && !hasInputTables && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {schemaDescription}
                </p>
            )}

            {/* Example: input rows + expected output, both as proper tables */}
            {(hasInputTables || hasOutput) && (
                <section>
                    <h3 className="text-sm font-semibold mb-3">Example</h3>

                    {hasInputTables && (
                        <div className="space-y-4 mb-5">
                            <div className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                                Input
                            </div>
                            {tableInfos!.map((t) => (
                                <div key={`sample-${t.name}`}>
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <code className="text-[12px] font-mono text-muted-foreground">
                                            {t.name}
                                        </code>
                                        <span className="text-[10px] text-muted-foreground tabular-nums">
                                            {t.sampleRows.length} row
                                            {t.sampleRows.length === 1 ? "" : "s"}
                                        </span>
                                    </div>
                                    <DataTable
                                        columns={t.columns.map((c) => c.name)}
                                        rows={t.sampleRows}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {hasOutput && (
                        <div className="space-y-2">
                            <div className="text-xs uppercase tracking-wide font-medium text-muted-foreground">
                                Output
                            </div>
                            <DataTable columns={expectedColumns!} rows={expectedRows!} />
                            <p className="text-[11px] text-muted-foreground">
                                Your query must return columns:{" "}
                                <code className="font-mono">
                                    {expectedColumns!.join(", ")}
                                </code>
                            </p>
                        </div>
                    )}
                </section>
            )}
        </div>
    )
}

function ColumnSchemaTable({
    columns,
}: {
    columns: { name: string; type: string }[]
}) {
    if (columns.length === 0) {
        return (
            <p className="text-xs text-muted-foreground italic">
                Schema unavailable.
            </p>
        )
    }
    return (
        <div className="rounded-md border border-border overflow-hidden">
            <table className="w-full text-[12px]">
                <thead className="bg-surface-muted">
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
        </div>
    )
}

function DataTable({
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

function SchemaTab({
    schemaDescription,
    schemaSql,
}: {
    schemaDescription: string | null
    schemaSql: string | null
}) {
    return (
        <div className="p-5 space-y-4">
            {schemaDescription && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        Overview
                    </h3>
                    <p className="text-sm leading-relaxed text-foreground/90">
                        {schemaDescription}
                    </p>
                </div>
            )}
            {schemaSql && (
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                        DDL
                    </h3>
                    <pre className="rounded-md border border-border bg-surface-muted px-3 py-3 text-[12px] leading-relaxed font-mono overflow-x-auto scrollbar-thin">
                        <code>{schemaSql}</code>
                    </pre>
                </div>
            )}
            {!schemaDescription && !schemaSql && (
                <p className="text-sm text-muted-foreground italic">
                    No schema details available.
                </p>
            )}
        </div>
    )
}

function HintsTab({ hints }: { hints: string[] }) {
    const [revealed, setRevealed] = useState(0)
    return (
        <div className="p-5 space-y-3">
            {hints.slice(0, revealed).map((hint, i) => (
                <div
                    key={i}
                    className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5"
                >
                    <div className="text-[11px] uppercase tracking-wide font-medium text-warning mb-1">
                        Hint {i + 1}
                    </div>
                    <p className="text-sm leading-relaxed">{hint}</p>
                </div>
            ))}
            {revealed < hints.length ? (
                <button
                    type="button"
                    onClick={() => setRevealed((r) => r + 1)}
                    className="w-full rounded-md border border-dashed border-border bg-surface-muted/40 px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
                >
                    <Lightbulb className="h-4 w-4" />
                    Reveal hint {revealed + 1} of {hints.length}
                </button>
            ) : (
                <p className="text-xs text-center text-muted-foreground italic pt-2">
                    All hints revealed.
                </p>
            )}
        </div>
    )
}

function TabBtn({
    active,
    onClick,
    icon,
    label,
    count,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
    count?: number
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "relative px-3 py-2.5 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap",
                active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
            )}
        >
            {icon}
            {label}
            {count != null && (
                <span className="text-[10px] tabular-nums text-muted-foreground">
                    {count}
                </span>
            )}
            {active && (
                <span
                    aria-hidden
                    className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full"
                />
            )}
        </button>
    )
}
