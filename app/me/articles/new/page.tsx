import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { MyArticleForm } from "@/components/me/MyArticleForm"

export const metadata = {
    title: "New article",
    robots: { index: false, follow: false },
}

export default async function NewMyArticlePage() {
    const firstTopic = await prisma.topic.findFirst({
        orderBy: { name: "asc" },
        select: { slug: true },
    })

    return (
        <Container width="lg" className="py-10">
            <Link
                href="/me/articles"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                New article
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Saves as a draft. Submit for review when you&apos;re ready — an
                admin will approve or send back with feedback.
            </p>
            <MyArticleForm
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
