import Link from "next/link"
import { getArticle } from "@/actions/content"
import { notFound } from "next/navigation"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'

type Props = {
    params: Promise<{ topicSlug: string; articleSlug: string }>
}

export default async function ArticlePage({ params }: Props) {
    const { topicSlug, articleSlug } = await params
    const { data: article, error } = await getArticle(articleSlug)

    if (error || !article) {
        notFound()
    }

    return (
        <div className="container mx-auto p-8 max-w-4xl">
            <Link href={`/learn/${topicSlug}`} className="text-blue-600 hover:underline mb-8 inline-block">&larr; Back to {article.topic.name}</Link>

            <article className="prose lg:prose-xl dark:prose-invert max-w-none">
                <h1 className="text-4xl font-bold mb-4">{article.title}</h1>
                <div className="text-gray-500 mb-8 pb-8 border-b">
                    Published on {new Date(article.createdAt).toLocaleDateString()}
                </div>

                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                        code({ node, inline, className, children, ...props }: any) {
                            const match = /language-(\w+)/.exec(className || '')
                            return !inline && match ? (
                                <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                >
                                    {String(children).replace(/\n$/, '')}
                                </SyntaxHighlighter>
                            ) : (
                                <code className={className} {...props}>
                                    {children}
                                </code>
                            )
                        }
                    }}
                >
                    {article.content}
                </ReactMarkdown>
            </article>
        </div>
    )
}
