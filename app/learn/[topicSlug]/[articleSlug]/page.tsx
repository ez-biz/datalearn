import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, ArrowRight, ChevronLeft, Clock } from "lucide-react"
import { getArticle, getArticleNeighbors } from "@/actions/content"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Container } from "@/components/ui/Container"
import { Badge } from "@/components/ui/Badge"
import { extractToc } from "@/lib/markdown-toc"
import { TableOfContents } from "@/components/learn/TableOfContents"
import { RelatedProblemsPanel } from "@/components/learn/RelatedProblemsPanel"

type Props = {
    params: Promise<{ topicSlug: string; articleSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleSlug } = await params
    const { data: article } = await getArticle(articleSlug)
    if (!article) return { title: "Article not found" }
    return {
        title: article.title,
        description: article.summary ?? undefined,
    }
}

export default async function ArticlePage({ params }: Props) {
    const { topicSlug, articleSlug } = await params
    const { data: article } = await getArticle(articleSlug)
    if (!article) notFound()

    const neighbors = await getArticleNeighbors(articleSlug)
    const toc = extractToc(article.content)

    return (
        <Container width="xl" className="py-10 sm:py-14">
            <div className="flex gap-8">
                <article className="flex-1 min-w-0 max-w-3xl mx-auto lg:mx-0">
                    <Link
                        href={`/learn/${topicSlug}`}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        {article.topic.name}
                    </Link>

                    <header className="mb-8 pb-6 border-b border-border">
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                            {article.title}
                        </h1>
                        {article.summary && (
                            <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
                                {article.summary}
                            </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {article.author?.name && (
                                <span>By {article.author.name}</span>
                            )}
                            <span>·</span>
                            <span>
                                {new Date(article.createdAt).toLocaleDateString(undefined, {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </span>
                            {article.readingMinutes != null && (
                                <>
                                    <span>·</span>
                                    <span className="inline-flex items-center gap-1 tabular-nums">
                                        <Clock className="h-3.5 w-3.5" />
                                        {article.readingMinutes} min read
                                    </span>
                                </>
                            )}
                        </div>
                        {article.tags.length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-1.5">
                                {article.tags.map((t) => (
                                    <Badge
                                        key={t.id}
                                        variant="secondary"
                                        className="normal-case tracking-normal"
                                    >
                                        {t.slug}
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </header>

                    <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-headings:scroll-mt-24 prose-a:text-primary hover:prose-a:text-primary-hover prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeSlug]}
                            components={{
                                code({ inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || "")
                                    return !inline && match ? (
                                        <SyntaxHighlighter
                                            style={vscDarkPlus}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{
                                                borderRadius: "0.5rem",
                                                fontSize: "13px",
                                                padding: "1rem",
                                                margin: "1.25rem 0",
                                                border: "1px solid hsl(var(--border))",
                                            }}
                                            {...props}
                                        >
                                            {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>
                                    ) : (
                                        <code className={className} {...props}>
                                            {children}
                                        </code>
                                    )
                                },
                            }}
                        >
                            {article.content}
                        </ReactMarkdown>
                    </div>

                    <RelatedProblemsPanel problems={article.relatedProblems} />

                    {(neighbors.prev || neighbors.next) && (
                        <nav
                            aria-label="Article navigation"
                            className="mt-12 pt-6 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3"
                        >
                            {neighbors.prev ? (
                                <Link
                                    href={`/learn/${topicSlug}/${neighbors.prev.slug}`}
                                    className="group rounded-md border border-border bg-surface p-4 hover:bg-surface-muted/60 transition-colors"
                                >
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1">
                                        <ArrowLeft className="h-3 w-3" />
                                        Previous
                                    </div>
                                    <div className="mt-1 text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">
                                        {neighbors.prev.title}
                                    </div>
                                </Link>
                            ) : (
                                <div />
                            )}
                            {neighbors.next ? (
                                <Link
                                    href={`/learn/${topicSlug}/${neighbors.next.slug}`}
                                    className="group rounded-md border border-border bg-surface p-4 hover:bg-surface-muted/60 transition-colors text-right"
                                >
                                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground inline-flex items-center gap-1 justify-end">
                                        Next
                                        <ArrowRight className="h-3 w-3" />
                                    </div>
                                    <div className="mt-1 text-sm font-medium text-foreground group-hover:text-primary line-clamp-1">
                                        {neighbors.next.title}
                                    </div>
                                </Link>
                            ) : (
                                <div />
                            )}
                        </nav>
                    )}
                </article>

                <TableOfContents entries={toc} />
            </div>
        </Container>
    )
}
