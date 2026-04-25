import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { getTopics } from "@/actions/content"
import { Container } from "@/components/ui/Container"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { EmptyState } from "@/components/ui/EmptyState"

export const metadata: Metadata = {
    title: "Learn",
    description:
        "Concept lessons on SQL, data engineering, and analytics fundamentals.",
}

export default async function LearnPage() {
    const { data: topics } = await getTopics()
    const list = topics ?? []

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Learning hub
                </h1>
                <p className="mt-2 text-muted-foreground max-w-2xl">
                    Short, focused lessons that explain the concepts behind each problem.
                </p>
            </header>

            {list.length === 0 ? (
                <EmptyState
                    icon={<BookOpen className="h-5 w-5" />}
                    title="No topics yet"
                    description="Lessons are on the way. In the meantime, jump into the practice problems."
                />
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {list.map((topic: any) => (
                        <Link key={topic.id} href={`/learn/${topic.slug}`} className="group">
                            <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                            <BookOpen className="h-5 w-5" />
                                        </div>
                                        <Badge variant="secondary">
                                            {topic._count.articles} {topic._count.articles === 1 ? "article" : "articles"}
                                        </Badge>
                                    </div>
                                    <h2 className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors">
                                        {topic.name}
                                    </h2>
                                    <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">
                                        {topic.description}
                                    </p>
                                    <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                        Browse articles
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </Container>
    )
}
