"use client"

import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import type { ComponentPropsWithoutRef, CSSProperties } from "react"
import remarkGfm from "remark-gfm"
import remarkDirective from "remark-directive"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Callout } from "@/components/markdown/directives/Callout"
import { Figure } from "@/components/markdown/directives/Figure"
import { Mermaid } from "@/components/markdown/directives/Mermaid"
import { SideBySide } from "@/components/markdown/directives/SideBySide"
import { Steps } from "@/components/markdown/directives/Steps"
import { remarkBlockDirectives } from "@/lib/markdown/remark-block-directives"

const prismTheme = vscDarkPlus as { [key: string]: CSSProperties }

interface MarkdownRendererProps {
    content: string
    empty?: string
}

export function MarkdownRenderer({
    content,
    empty = "Nothing to preview.",
}: MarkdownRendererProps) {
    const trimmed = content.trim()
    const components = {
        code({ className, children }: ComponentPropsWithoutRef<"code">) {
            const match = /language-(\w+)/.exec(className || "")
            return match ? (
                <SyntaxHighlighter
                    style={prismTheme}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                        borderRadius: "0.375rem",
                        fontSize: "12px",
                        lineHeight: "1.55",
                        padding: "0.75rem",
                        margin: "0.75rem 0",
                        border: "1px solid hsl(var(--border))",
                    }}
                >
                    {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
            ) : (
                <code className={className}>
                    {children}
                </code>
            )
        },
        "dl-callout": Callout,
        "dl-figure": Figure,
        "dl-mermaid": Mermaid,
        "dl-side-by-side": SideBySide,
        "dl-steps": Steps,
    } as Components

    if (!trimmed) {
        return (
            <p className="text-sm italic text-muted-foreground">
                {empty}
            </p>
        )
    }

    return (
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none break-words prose-headings:font-semibold prose-headings:tracking-tight prose-a:break-all prose-a:text-primary hover:prose-a:text-primary-hover prose-p:leading-relaxed prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none prose-pre:overflow-x-auto prose-pre:bg-transparent prose-pre:p-0 prose-table:text-[12px] prose-th:bg-surface-muted prose-th:px-2 prose-td:px-2 prose-td:py-1">
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkDirective, remarkBlockDirectives]}
                components={components}
            >
                {trimmed}
            </ReactMarkdown>
        </div>
    )
}
