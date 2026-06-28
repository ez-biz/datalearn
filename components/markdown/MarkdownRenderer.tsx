"use client"

import ReactMarkdown from "react-markdown"
import type { Components } from "react-markdown"
import type { ComponentPropsWithoutRef } from "react"
import remarkGfm from "remark-gfm"
import remarkDirective from "remark-directive"
import rehypeSlug from "rehype-slug"
import { Callout } from "@/components/markdown/directives/Callout"
import { Figure } from "@/components/markdown/directives/Figure"
import { Mermaid } from "@/components/markdown/directives/Mermaid"
import { SideBySide } from "@/components/markdown/directives/SideBySide"
import { Steps } from "@/components/markdown/directives/Steps"
import { CodeBlock } from "@/components/ui/CodeBlock"
import { ScrollableTable } from "@/components/ui/ScrollableTable"
import { remarkBlockDirectives } from "@/lib/markdown/remark-block-directives"
import { cn } from "@/lib/utils"

interface MarkdownRendererProps {
    content: string
    empty?: string
    className?: string
    size?: "sm" | "base"
    withHeadingIds?: boolean
}

export function MarkdownRenderer({
    content,
    empty = "Nothing to preview.",
    className,
    size = "sm",
    withHeadingIds = false,
}: MarkdownRendererProps) {
    const trimmed = content.trim()
    const components = {
        code({ className, children }: ComponentPropsWithoutRef<"code">) {
            const match = /language-(\w+)/.exec(className || "")
            return match ? (
                <CodeBlock language={match[1]}>{String(children)}</CodeBlock>
            ) : (
                <code className={className}>
                    {children}
                </code>
            )
        },
        table({
            children,
            className,
            ...props
        }: ComponentPropsWithoutRef<"table">) {
            return (
                <ScrollableTable className="my-3 rounded-md border border-border">
                    <table className={cn("w-full text-[12px]", className)} {...props}>
                        {children}
                    </table>
                </ScrollableTable>
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
        <div
            className={cn(
                "prose prose-neutral dark:prose-invert max-w-none break-words prose-headings:font-semibold prose-headings:tracking-tight prose-a:break-all prose-a:text-primary hover:prose-a:text-primary-hover prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none prose-pre:overflow-x-auto prose-pre:bg-transparent prose-pre:p-0 prose-table:text-[12px] prose-th:bg-surface-muted prose-th:px-2 prose-td:px-2 prose-td:py-1",
                size === "sm" && "prose-sm",
                className
            )}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkDirective, remarkBlockDirectives]}
                rehypePlugins={withHeadingIds ? [rehypeSlug] : undefined}
                components={components}
            >
                {trimmed}
            </ReactMarkdown>
        </div>
    )
}
