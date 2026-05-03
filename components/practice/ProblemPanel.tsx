"use client"

import { useState } from "react"
import {
    CheckCircle2,
    ChevronRight,
    FileText,
    History as HistoryIcon,
    Lightbulb,
    Loader2,
    MessagesSquare,
} from "lucide-react"
import { DifficultyBadge, Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"
import { HistoryPanel } from "./HistoryPanel"
import { RelatedArticlesPanel } from "./RelatedArticlesPanel"
import {
    DiscussionPanel,
    type DiscussionMode,
} from "./discussion/DiscussionPanel"
import type { ProblemHistoryEntry } from "@/actions/submissions"

export type RelatedArticle = {
    id: string
    slug: string
    title: string
    summary: string | null
    readingMinutes: number | null
    topic: { slug: string }
}

type Tab = "description" | "hints" | "history" | "discussion"

export type TableInfo = {
    name: string
    columns: { name: string; type: string }[]
    sampleRows: Record<string, unknown>[]
}

interface ProblemPanelProps {
    number: number
    title: string
    difficulty: string
    description: string | null
    schemaDescription: string | null
    hints: string[]
    tableInfos: TableInfo[] | null
    tablesLoading: boolean
    expectedRows: Record<string, unknown>[] | null
    expectedColumns: string[] | null
    history: ProblemHistoryEntry[]
    isSolved: boolean
    relatedArticles: RelatedArticle[]
    onLoadCode: (code: string) => void
    onShareApproach?: (code: string) => void
    slug: string
    isSignedIn: boolean
    viewerUserId: string | null
    discussionMode: DiscussionMode
    discussionEnabled: boolean
    discussionPrefill: string | null
    onDiscussionPrefillConsumed: () => void
}

export function ProblemPanel({
    number,
    title,
    difficulty,
    description,
    schemaDescription,
    hints,
    tableInfos,
    tablesLoading,
    expectedRows,
    expectedColumns,
    history,
    isSolved,
    relatedArticles,
    onLoadCode,
    onShareApproach,
    slug,
    isSignedIn,
    viewerUserId,
    discussionMode,
    discussionEnabled,
    discussionPrefill,
    onDiscussionPrefillConsumed,
}: ProblemPanelProps) {
    const [tab, setTab] = useState<Tab>("description")
    const hasHints = hints.length > 0
    const showDiscussion = discussionEnabled && discussionMode !== "HIDDEN"
    const activeTab = tab === "discussion" && !showDiscussion ? "description" : tab
    const shareApproach = (code: string) => {
        if (showDiscussion) {
            setTab("discussion")
        }
        onShareApproach?.(code)
    }

    return (
        <div className="h-full flex flex-col bg-surface">
            <div className="border-b border-border px-5 pt-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-semibold tracking-tight leading-tight">
                        <span className="text-muted-foreground tabular-nums font-medium mr-1.5">
                            {number}.
                        </span>
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
                        active={activeTab === "description"}
                        onClick={() => setTab("description")}
                        icon={<FileText className="h-3.5 w-3.5" />}
                        label="Description"
                    />
                    {hasHints && (
                        <TabBtn
                            active={activeTab === "hints"}
                            onClick={() => setTab("hints")}
                            icon={<Lightbulb className="h-3.5 w-3.5" />}
                            label="Hints"
                            count={hints.length}
                        />
                    )}
                    <TabBtn
                        active={activeTab === "history"}
                        onClick={() => setTab("history")}
                        icon={<HistoryIcon className="h-3.5 w-3.5" />}
                        label="History"
                        count={history.length || undefined}
                    />
                    {showDiscussion && (
                        <TabBtn
                            active={activeTab === "discussion"}
                            onClick={() => setTab("discussion")}
                            icon={<MessagesSquare className="h-3.5 w-3.5" />}
                            label="Discussion"
                        />
                    )}
                </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {activeTab === "description" && (
                    <DescriptionTab
                        description={description}
                        schemaDescription={schemaDescription}
                        tableInfos={tableInfos}
                        tablesLoading={tablesLoading}
                        expectedRows={expectedRows}
                        expectedColumns={expectedColumns}
                        relatedArticles={relatedArticles}
                    />
                )}
                {activeTab === "hints" && hasHints && <HintsTab hints={hints} />}
                {activeTab === "history" && (
                    <HistoryPanel
                        history={history}
                        onLoadCode={onLoadCode}
                        onShareApproach={shareApproach}
                    />
                )}
                {activeTab === "discussion" && showDiscussion && (
                    <DiscussionPanel
                        problemSlug={slug}
                        isSignedIn={isSignedIn}
                        viewerUserId={viewerUserId}
                        discussionMode={discussionMode}
                        discussionEnabled={discussionEnabled}
                        prefillMarkdown={discussionPrefill}
                        onPrefillConsumed={onDiscussionPrefillConsumed}
                    />
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
    relatedArticles,
}: {
    description: string | null
    schemaDescription: string | null
    relatedArticles: RelatedArticle[]
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
            {/* Problem prose — first, so the user sees the task immediately */}
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

            {/* Schema overview — collapsed by default when there are many tables */}
            {tablesLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading schema…
                </div>
            ) : hasInputTables ? (
                <SchemaOverview tables={tableInfos!} />
            ) : null}

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

            {relatedArticles.length > 0 && (
                <RelatedArticlesPanel articles={relatedArticles} />
            )}
        </div>
    )
}

function SchemaOverview({ tables }: { tables: TableInfo[] }) {
    const collapseByDefault = tables.length > 2
    return (
        <section>
            <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-semibold">Schema</h3>
                <span className="text-xs text-muted-foreground tabular-nums">
                    {tables.length} {tables.length === 1 ? "table" : "tables"}
                </span>
            </div>
            <div className="space-y-2">
                {tables.map((t) => (
                    <details
                        key={t.name}
                        open={!collapseByDefault}
                        className="group rounded-md border border-border bg-surface-muted/30 overflow-hidden"
                    >
                        <summary className="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-surface-muted/60 list-none [&::-webkit-details-marker]:hidden">
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-90" />
                            <span className="text-sm font-medium">Table:</span>
                            <code className="rounded bg-surface px-1.5 py-0.5 text-[12px] font-mono border border-border">
                                {t.name}
                            </code>
                            <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                                {t.columns.length} cols
                            </span>
                        </summary>
                        <div className="border-t border-border bg-surface">
                            <ColumnSchemaTable columns={t.columns} />
                        </div>
                    </details>
                ))}
            </div>
        </section>
    )
}

function ColumnSchemaTable({
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
