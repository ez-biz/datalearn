"use client"

import { useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"
import DOMPurify from "isomorphic-dompurify"

const PURIFY_CONFIG = {
    USE_PROFILES: { svg: true, svgFilters: false },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: ["href", "xlink:href", "style"],
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#)/i,
}

const ON_HANDLER_RE = /^on/i

function removeEventHandlers(svg: string): string {
    const wrapper = document.createElement("div")
    wrapper.innerHTML = svg
    wrapper.querySelectorAll("*").forEach((element) => {
        for (const attr of Array.from(element.attributes)) {
            if (ON_HANDLER_RE.test(attr.name)) {
                element.removeAttribute(attr.name)
            }
        }
    })
    return wrapper.innerHTML
}

interface MermaidClientProps {
    source: string
    idHint: string
}

export function MermaidClient({ source, idHint }: MermaidClientProps) {
    const ref = useRef<HTMLDivElement>(null)
    const { resolvedTheme } = useTheme()
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false

        async function renderMermaid() {
            try {
                setError(null)
                const mermaid = (await import("mermaid")).default
                mermaid.initialize({
                    startOnLoad: false,
                    theme: resolvedTheme === "dark" ? "dark" : "default",
                    securityLevel: "strict",
                    htmlLabels: false,
                    flowchart: { htmlLabels: false },
                })
                const renderId = `mmd-${idHint}-${Math.random()
                    .toString(36)
                    .slice(2)}`
                const { svg } = await mermaid.render(renderId, source)
                if (cancelled || !ref.current) return

                const cleaned = DOMPurify.sanitize(svg, PURIFY_CONFIG)
                ref.current.innerHTML = removeEventHandlers(cleaned)
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "render failed")
                }
            }
        }

        renderMermaid()

        return () => {
            cancelled = true
        }
    }, [source, resolvedTheme, idHint])

    if (error) {
        return (
            <div className="my-4 rounded-md border border-border bg-surface-muted p-3">
                <div className="mb-1 text-xs text-muted-foreground">
                    Mermaid render failed: {error}
                </div>
                <pre className="overflow-auto rounded-md bg-surface p-3 text-xs text-foreground">
                    <code>{source}</code>
                </pre>
            </div>
        )
    }

    return <div ref={ref} className="dl-mermaid" />
}
