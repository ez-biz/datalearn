import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { ArticleForm } from "@/components/admin/ArticleForm"

export const metadata = {
    title: "New article",
    robots: { index: false, follow: false },
}

export default async function NewArticlePage() {
    // Pre-pick a topic if one exists
    const firstTopic = await prisma.topic.findFirst({
        orderBy: { name: "asc" },
        select: { slug: true },
    })

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
                New article
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Submitted via{" "}
                <code className="font-mono text-xs">POST /api/admin/articles</code>
            </p>
            <ArticleForm
                initial={{
                    mode: "create",
                    title: "",
                    slug: "",
                    topicSlug: firstTopic?.slug ?? "",
                    content: "",
                    summary: "",
                    status: "DRAFT",
                    tagSlugs: [],
                    relatedProblemSlugs: [],
                    reviewNotes: null,
                }}
            />
        </Container>
    )
}
