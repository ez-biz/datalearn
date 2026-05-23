import dynamic from "next/dynamic"
import type { ReactNode } from "react"
import { ScrollableTable } from "@/components/ui/ScrollableTable"

const MermaidClient = dynamic(
    () => import("./MermaidClient").then((module) => module.MermaidClient),
    {
        ssr: false,
        loading: () => <div className="dl-mermaid-loading h-32" />,
    }
)

interface MermaidProps {
    alt?: string
    caption?: string
    children?: ReactNode
}

function extractText(children: ReactNode): string {
    if (typeof children === "string" || typeof children === "number") {
        return String(children)
    }
    if (Array.isArray(children)) {
        return children.map(extractText).join("")
    }
    if (children && typeof children === "object" && "props" in children) {
        return extractText((children as { props: { children?: ReactNode } }).props.children)
    }
    return ""
}

export function Mermaid({ alt, caption, children }: MermaidProps) {
    const source = extractText(children).trim()
    if (!alt) {
        return (
            <figure className="my-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                :::mermaid rejected: missing alt
            </figure>
        )
    }

    return (
        <figure
            className="my-6 overflow-hidden rounded-lg border border-border bg-surface"
            aria-label={alt}
        >
            <ScrollableTable className="bg-surface-muted">
                <div className="flex items-center justify-center p-6">
                    <MermaidClient
                        source={source}
                        idHint={alt.replace(/[^a-z0-9]/gi, "").slice(0, 16)}
                    />
                </div>
            </ScrollableTable>
            {caption && (
                <figcaption className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                    {caption}
                </figcaption>
            )}
        </figure>
    )
}
