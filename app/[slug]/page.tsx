import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Container } from "@/components/ui/Container"

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const page = await prisma.page.findUnique({ where: { slug } })
    if (!page || !page.isActive) return { title: "Page not found" }
    return { title: page.title }
}

export default async function DynamicPage({ params }: Props) {
    const { slug } = await params
    const page = await prisma.page.findUnique({ where: { slug } })

    if (!page || !page.isActive) {
        notFound()
    }

    return (
        <Container width="md" className="py-10 sm:py-14">
            <article>
                <header className="mb-8 pb-6 border-b border-border">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {page.title}
                    </h1>
                </header>
                <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary-hover prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {page.content || ""}
                    </ReactMarkdown>
                </div>
            </article>
        </Container>
    )
}
