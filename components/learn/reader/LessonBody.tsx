import type { ReactNode } from "react"
import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer"
import { cn } from "@/lib/utils"

/**
 * Drop a leading H1 from article markdown.
 *
 * Every authored lesson opens with a `# Heading` byte-identical to
 * `article.title`, and the page renders the title in its own <h1>. Without
 * this, every article ships two top-level headings — which is both an
 * accessibility defect and, in the reader, a visible duplicate.
 *
 * Only a heading at the very start is removed, so a legitimate H1 further
 * down (rare, but valid) survives. The prefix admits whitespace-only blank
 * lines and CommonMark's one-to-three-space ATX indentation, but deliberately
 * stops short of four spaces. A broad `\s*` would consume the indentation of
 * an indented code block that starts with `    # TODO: ...`, silently deleting
 * it instead of leaving the block untouched.
 */
export function stripLeadingH1(content: string, title: string): string {
    const match = content.match(
        /^(?:[ \t]*\r?\n)* {0,3}# ([^\r\n]*)(?:(?:\r?\n)+|$)/,
    )
    if (!match || match[1] !== title) return content
    return content.slice(match[0].length)
}

interface LessonBodyProps {
    title: string
    summary: string | null
    content: string
    /** Mono meta line above the title. */
    metaSlot?: ReactNode
    /**
     * Rendered below the summary and above the body. The topic article
     * route puts its byline/reading-time row and tag chips here, which is
     * where they have always sat.
     */
    belowSummarySlot?: ReactNode
    className?: string
}

/**
 * The reading column, shared by the curriculum reader and the topic
 * article route so both stay typographically identical.
 */
export function LessonBody({
    title,
    summary,
    content,
    metaSlot,
    belowSummarySlot,
    className,
}: LessonBodyProps) {
    return (
        <div className={cn("mx-auto w-full max-w-[84ch]", className)}>
            {metaSlot}
            <h1 className="mt-2 text-[27px] font-semibold leading-tight tracking-[-0.025em] text-foreground lg:text-[34px]">
                {title}
            </h1>
            {summary && (
                <p className="mt-3 text-base leading-[1.55] text-text-muted">
                    {summary}
                </p>
            )}
            {belowSummarySlot}
            <div className="article-body mt-8">
                <MarkdownRenderer
                    content={stripLeadingH1(content, title)}
                    size="base"
                    withHeadingIds
                />
            </div>
        </div>
    )
}
