"use client"

import { ChevronRight, Loader2 } from "lucide-react"
import { RelatedArticlesPanel } from "@/components/practice/RelatedArticlesPanel"
import type { RelatedArticle, TableInfo } from "@/lib/workspace/types"
import { formatPassRate, PASS_RATE_TITLE } from "@/lib/workspace/pass-rate"
import { CollapsibleSection } from "../CollapsibleSection"
import { ColumnSchemaTable, DataTable } from "../DataTable"

interface DescriptionTabProps {
    description: string | null
    schemaDescription: string | null
    tableInfos: TableInfo[] | null
    tablesLoading: boolean
    expectedRows: Record<string, unknown>[] | null
    expectedColumns: string[] | null
    relatedArticles: RelatedArticle[]
    /** True the first time this learner opens this problem; null until resolved. */
    firstVisit: boolean | null
    /** "Comes from" card, or null when the problem has no lesson. */
    comesFrom: React.ReactNode | null
    attemptCount: number
    acceptedCount: number
}

export function DescriptionTab({
    description,
    schemaDescription,
    tableInfos,
    tablesLoading,
    expectedRows,
    expectedColumns,
    relatedArticles,
    firstVisit,
    comesFrom,
    attemptCount,
    acceptedCount,
}: DescriptionTabProps) {
    const passRate = formatPassRate(acceptedCount, attemptCount)
    const hasInputTables = tableInfos && tableInfos.length > 0
    const hasOutput =
        expectedColumns &&
        expectedColumns.length > 0 &&
        expectedRows &&
        expectedRows.length > 0

    return (
        <div className="w-full space-y-5 p-5">
            {/* Problem prose first, so the task is visible immediately.
                NOT using `prose`: Tailwind Typography sets max-width 65ch +
                margin auto, which centers the text in a narrow column inside
                the panel even with max-w-none. Inline code is styled by hand
                instead. */}
            {passRate && (
                <div className="flex justify-end">
                    <span
                        title={PASS_RATE_TITLE}
                        className="font-mono text-[11px] tabular-nums text-muted-foreground"
                    >
                        {passRate}
                    </span>
                </div>
            )}

            {description && (
                <section className="text-sm leading-relaxed text-foreground/90 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-surface-muted [&_code]:text-foreground">
                    <p className="whitespace-pre-wrap">{description}</p>
                </section>
            )}

            {schemaDescription && !hasInputTables && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                    {schemaDescription}
                </p>
            )}

            {tablesLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading schema…
                </div>
            ) : hasInputTables ? (
                <CollapsibleSection
                    key={`schema-${firstVisit}`}
                    label="Schema"
                    meta={`${tableInfos!.length} ${
                        tableInfos!.length === 1 ? "table" : "tables"
                    }`}
                    defaultOpen={firstVisit === true}
                >
                    <div className="divide-y divide-border">
                        {tableInfos!.map((t) => (
                            <TableBlock key={t.name} table={t} />
                        ))}
                    </div>
                </CollapsibleSection>
            ) : null}

            {hasOutput && (
                <CollapsibleSection
                    key={`expected-${firstVisit}`}
                    label="Expected output"
                    meta={`${expectedRows!.length} ${
                        expectedRows!.length === 1 ? "row" : "rows"
                    }`}
                    defaultOpen={firstVisit === true}
                >
                    <div className="space-y-2 p-3">
                        <DataTable columns={expectedColumns!} rows={expectedRows!} />
                        <p className="text-[11px] text-muted-foreground">
                            Your query must return columns:{" "}
                            <code className="font-mono">
                                {expectedColumns!.join(", ")}
                            </code>
                        </p>
                    </div>
                </CollapsibleSection>
            )}

            {hasInputTables && (
                <section>
                    <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Input
                    </div>
                    <div className="space-y-4">
                        {tableInfos!.map((t) => (
                            <div key={`sample-${t.name}`}>
                                <div className="mb-1.5 flex items-center gap-2">
                                    <code className="font-mono text-[12px] text-muted-foreground">
                                        {t.name}
                                    </code>
                                    <span className="text-[10px] tabular-nums text-muted-foreground">
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
                </section>
            )}

            {comesFrom}

            {relatedArticles.length > 0 && (
                <RelatedArticlesPanel articles={relatedArticles} />
            )}
        </div>
    )
}

/** One table inside the Schema collapsible, with its own disclosure. */
function TableBlock({ table }: { table: TableInfo }) {
    return (
        <details open className="group">
            <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2 hover:bg-surface-hover [&::-webkit-details-marker]:hidden">
                <ChevronRight
                    className="h-3.5 w-3.5 text-muted-foreground transition-transform duration-150 group-open:rotate-90"
                    aria-hidden
                />
                <code className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[12px]">
                    {table.name}
                </code>
                <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
                    {table.columns.length} cols
                </span>
            </summary>
            <div className="border-t border-border bg-surface">
                <ColumnSchemaTable columns={table.columns} />
            </div>
        </details>
    )
}
