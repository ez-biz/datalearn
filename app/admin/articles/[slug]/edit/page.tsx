import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { ArticleForm } from "@/components/admin/ArticleForm"

export const metadata = {
    title: "Edit article",
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ slug: string }> }

export default async function EditArticlePage({ params }: Props) {
    const { slug } = await params
    const article = await prisma.article.findUnique({
        where: { slug },
        include: {
            topic: { select: { slug: true } },
            tags: { select: { slug: true } },
            relatedProblems: { select: { slug: true } },
        },
    })
    if (!article) notFound()

    return (
        <Container width="lg" className="py-10">
            <Link
                href="/admin/articles"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to articles
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                Edit · {article.title}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Saved via{" "}
                <code className="font-mono text-xs">
                    PATCH /api/admin/articles/{article.slug}
                </code>
            </p>
            <ArticleForm
                originalSlug={article.slug}
                initial={{
                    mode: "edit",
                    title: article.title,
                    slug: article.slug,
                    topicSlug: article.topic.slug,
                    content: article.content,
                    summary: article.summary ?? "",
                    status: article.status,
                    tagSlugs: article.tags.map((t) => t.slug),
                    relatedProblemSlugs: article.relatedProblems.map((p) => p.slug),
                    reviewNotes: article.reviewNotes,
                }}
            />
        </Container>
    )
}
