import type { ReactNode } from "react"
import { Eyebrow } from "@/components/ui/Eyebrow"

const KIND_STYLE: Record<string, string> = {
    tip: "border-l-primary bg-primary/5 [&_.dl-callout-tag]:text-primary",
    pitfall: "border-l-accent bg-accent/5 [&_.dl-callout-tag]:text-accent",
    warning:
        "border-l-destructive bg-destructive/5 [&_.dl-callout-tag]:text-destructive",
    note: "border-l-muted-foreground bg-muted [&_.dl-callout-tag]:text-muted-foreground",
}

const KIND_LABEL: Record<string, string> = {
    tip: "Tip",
    pitfall: "Pitfall",
    warning: "Warning",
    note: "Note",
}

interface CalloutProps {
    kind?: string
    children?: ReactNode
}

export function Callout({ kind, children }: CalloutProps) {
    const safeKind =
        kind && KIND_STYLE[kind] ? (kind as keyof typeof KIND_STYLE) : "note"

    return (
        <aside
            className={`my-6 rounded-md border-l-[3px] px-4 py-3 ${KIND_STYLE[safeKind]}`}
        >
            <Eyebrow variant="bracket" className="dl-callout-tag mb-1">
                {KIND_LABEL[safeKind].toUpperCase()}
            </Eyebrow>
            <div>{children}</div>
        </aside>
    )
}
