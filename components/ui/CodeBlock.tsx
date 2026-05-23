"use client"

import { useEffect, useState } from "react"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { cn } from "@/lib/utils"

const WRAP_STORAGE_KEY = "dl:codeblock:wrap"
const prismTheme = vscDarkPlus as Record<string, React.CSSProperties>

interface CodeBlockProps {
    language?: string
    children: string
    className?: string
}

export function CodeBlock({ language, children, className }: CodeBlockProps) {
    const [wrap, setWrap] = useState<boolean | null>(null)

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(WRAP_STORAGE_KEY)
            setWrap(stored === "1")
        } catch {
            setWrap(false)
        }
    }, [])

    const toggleWrap = () => {
        setWrap((prev) => {
            const next = !prev
            try {
                window.localStorage.setItem(WRAP_STORAGE_KEY, next ? "1" : "0")
            } catch {}
            return next
        })
    }

    const isWrap = wrap === true
    const code = String(children).replace(/\n$/, "")

    return (
        <div className={cn("relative my-3 group", className)}>
            <button
                type="button"
                onClick={toggleWrap}
                className="absolute right-2 top-2 z-10 rounded-md border border-border bg-surface-muted/80 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={isWrap ? "Disable soft-wrap" : "Enable soft-wrap"}
            >
                {isWrap ? "no wrap" : "wrap"}
            </button>
            <SyntaxHighlighter
                style={prismTheme}
                language={language ?? "sql"}
                PreTag="div"
                wrapLongLines={isWrap}
                customStyle={{
                    borderRadius: "0.375rem",
                    fontSize: "12px",
                    lineHeight: "1.55",
                    padding: "0.75rem",
                    margin: 0,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--surface-muted))",
                    whiteSpace: isWrap ? "pre-wrap" : "pre",
                }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    )
}
