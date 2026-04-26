import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"

interface RelatedArticle {
    id: string
    slug: string
    title: string
    summary: string | null
    readingMinutes: number | null
    topic: { slug: string }
}

export function RelatedArticlesPanel({
    articles,
}: {
    articles: RelatedArticle[]
}) {
    if (articles.length === 0) return null
    return (
        <section>
            <header className="flex items-center gap-2 mb-2">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Read more
                </h3>
            </header>
            <ul className="space-y-1.5">
                {articles.map((a) => (
                    <li key={a.id}>
                        <Link
                            href={`/learn/${a.topic.slug}/${a.slug}`}
                            className="group flex items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 hover:bg-surface-muted/60 transition-colors"
                        >
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                                    {a.title}
                                </div>
                                {a.summary && (
                                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                                        {a.summary}
                                    </p>
                                )}
                                {a.readingMinutes != null && (
                                    <span className="text-[11px] text-muted-foreground tabular-nums">
                                        {a.readingMinutes} min read
                                    </span>
                                )}
                            </div>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground self-center shrink-0 group-hover:text-primary group-hover:translate-x-0.5 transition-[color,translate] duration-150" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
