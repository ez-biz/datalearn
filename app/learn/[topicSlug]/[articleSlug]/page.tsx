import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getArticle } from "@/actions/content"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter"
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism"
import { Container } from "@/components/ui/Container"

type Props = {
    params: Promise<{ topicSlug: string; articleSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { articleSlug } = await params
    const { data: article } = await getArticle(articleSlug)
    if (!article) return { title: "Article not found" }
    return { title: article.title }
}

export default async function ArticlePage({ params }: Props) {
    const { topicSlug, articleSlug } = await params
    const { data: article } = await getArticle(articleSlug)

    if (!article) {
        notFound()
    }

    return (
        <Container width="md" className="py-10 sm:py-14">
            <Link
                href={`/learn/${topicSlug}`}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ChevronLeft className="h-4 w-4" />
                {article.topic.name}
            </Link>

            <article>
                <header className="mb-8 pb-6 border-b border-border">
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
                        {article.title}
                    </h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        Published{" "}
                        {new Date(article.createdAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                        })}
                    </p>
                </header>

                <div className="prose prose-neutral dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-a:text-primary hover:prose-a:text-primary-hover prose-code:font-mono prose-code:text-[0.85em] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-surface-muted prose-code:before:content-none prose-code:after:content-none prose-pre:bg-transparent prose-pre:p-0">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
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
            </article>
        </Container>
    )
}
