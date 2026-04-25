import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft, Clock, FileText } from "lucide-react"
import { getTopic } from "@/actions/content"
import { notFound } from "next/navigation"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

type Props = {
    params: Promise<{ topicSlug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { topicSlug } = await params
    const { data: topic } = await getTopic(topicSlug)
    if (!topic) return { title: "Topic not found" }
    return {
        title: topic.name,
        description: topic.description ?? undefined,
    }
}

export default async function TopicPage({ params }: Props) {
    const { topicSlug } = await params
    const { data: topic } = await getTopic(topicSlug)

    if (!topic) {
        notFound()
    }

    return (
        <Container width="md" className="py-10 sm:py-14">
            <Link
                href="/learn"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
                <ChevronLeft className="h-4 w-4" />
                All topics
            </Link>
            <header className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    {topic.name}
                </h1>
                {topic.description && (
                    <p className="mt-3 text-lg text-muted-foreground leading-relaxed">
                        {topic.description}
                    </p>
                )}
            </header>

            {topic.articles.length === 0 ? (
                <EmptyState
                    icon={<FileText className="h-5 w-5" />}
                    title="No articles yet in this topic"
                    description="New lessons are being written. Check back soon."
                />
            ) : (
                <Card className="overflow-hidden divide-y divide-border">
                    {topic.articles.map((article, i) => (
                        <Link
                            key={article.id}
                            href={`/learn/${topicSlug}/${article.slug}`}
                            className="flex items-start gap-4 p-5 hover:bg-surface-muted/60 transition-colors group"
                        >
                            <span className="hidden sm:inline-block w-6 mt-0.5 text-xs tabular-nums text-muted-foreground">
                                {String(i + 1).padStart(2, "0")}
                            </span>
                            <div className="flex-1 min-w-0">
                                <h2 className="font-medium text-foreground group-hover:text-primary transition-colors">
                                    {article.title}
                                </h2>
                                {article.summary && (
                                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                                        {article.summary}
                                    </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>
                                        {new Date(article.createdAt).toLocaleDateString(
                                            undefined,
                                            {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            }
                                        )}
                                    </span>
                                    {article.readingMinutes != null && (
                                        <>
                                            <span>·</span>
                                            <span className="inline-flex items-center gap-1 tabular-nums">
                                                <Clock className="h-3 w-3" />
                                                {article.readingMinutes} min
                                            </span>
                                        </>
                                    )}
                                    {article.tags.length > 0 && (
                                        <>
                                            <span>·</span>
                                            <span className="inline-flex flex-wrap gap-1">
                                                {article.tags.slice(0, 3).map((t) => (
                                                    <Badge
                                                        key={t.id}
                                                        variant="secondary"
                                                        className="normal-case tracking-normal text-[10px] py-0 px-1.5"
                                                    >
                                                        {t.slug}
                                                    </Badge>
                                                ))}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </Card>
            )}
        </Container>
    )
}
