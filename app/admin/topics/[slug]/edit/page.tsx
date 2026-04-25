import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { Container } from "@/components/ui/Container"
import { TopicEditForm } from "@/components/admin/TopicEditForm"

export const metadata = {
    title: "Edit topic",
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ slug: string }> }

export default async function EditTopicPage({ params }: Props) {
    const { slug } = await params
    const topic = await prisma.topic.findUnique({ where: { slug } })
    if (!topic) notFound()

    return (
        <Container width="md" className="py-10">
            <Link
                href="/admin/topics"
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
            >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back to topics
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">
                Edit · {topic.name}
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
                Saved via{" "}
                <code className="font-mono text-xs">
                    PATCH /api/admin/topics/{topic.slug}
                </code>
            </p>
            <TopicEditForm
                originalSlug={topic.slug}
                initial={{
                    name: topic.name,
                    slug: topic.slug,
                    description: topic.description ?? "",
                }}
            />
        </Container>
    )
}
