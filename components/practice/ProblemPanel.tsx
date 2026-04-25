"use client"

import { useState } from "react"
import { Database, FileText } from "lucide-react"
import { DifficultyBadge } from "@/components/ui/Badge"
import { cn } from "@/lib/utils"

type Tab = "description" | "schema"

interface ProblemPanelProps {
    title: string
    difficulty: string
    description: string | null
    schemaDescription: string | null
    schemaSql: string | null
}

export function ProblemPanel({
    title,
    difficulty,
    description,
    schemaDescription,
    schemaSql,
}: ProblemPanelProps) {
    const [tab, setTab] = useState<Tab>("description")

    return (
        <div className="h-full flex flex-col bg-surface">
            <div className="border-b border-border px-5 pt-5 pb-3">
                <div className="flex items-start justify-between gap-3">
                    <h1 className="text-xl font-semibold tracking-tight leading-tight">
                        {title}
                    </h1>
                    <DifficultyBadge difficulty={difficulty} />
                </div>
            </div>
            <div className="border-b border-border px-2">
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
                </div>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
                {tab === "description" ? (
                    <div className="p-5">
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none">
                            {description ? (
                                <p className="whitespace-pre-wrap">{description}</p>
                            ) : (
                                <p className="text-muted-foreground italic">
                                    No description provided.
                                </p>
                            )}
                        </div>
                    </div>
                ) : (
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
                )}
            </div>
        </div>
    )
}

function TabBtn({
    active,
    onClick,
    icon,
    label,
}: {
    active: boolean
    onClick: () => void
    icon: React.ReactNode
    label: string
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                "relative px-3 py-2.5 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors",
                active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
            )}
        >
            {icon}
            {label}
            {active && (
                <span
                    aria-hidden
                    className="absolute left-2 right-2 -bottom-px h-0.5 bg-primary rounded-full"
                />
            )}
        </button>
    )
}
