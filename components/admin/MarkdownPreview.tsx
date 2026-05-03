import { MarkdownRenderer } from "@/components/markdown/MarkdownRenderer"

export function MarkdownPreview({ content }: { content: string }) {
    return <MarkdownRenderer content={content} empty="(empty)" />
}
