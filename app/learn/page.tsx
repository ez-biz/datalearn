import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, BookOpen, Route } from "lucide-react"
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

    type TopicCard = (typeof list)[number]

    function laneLabel(lane: "SQL" | "DATA_ENGINEERING") {
        return lane === "SQL" ? "SQL fundamentals" : "Data engineering concepts"
    }

    const sqlTopics = list.filter((t: TopicCard) => t.lane === "SQL")
    const deTopics = list.filter((t: TopicCard) => t.lane === "DATA_ENGINEERING")

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                        Learning hub
                    </h1>
                    <p className="mt-2 text-muted-foreground max-w-2xl">
                        Short, focused lessons that explain the concepts behind
                        each problem.
                    </p>
                </div>
                <Link
                    href="/learn/tracks"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Route className="h-3.5 w-3.5" />
                    Tracks
                </Link>
            </header>

            {list.length === 0 ? (
                <EmptyState
                    icon={<BookOpen className="h-5 w-5" />}
                    title="No topics yet"
                    description="Lessons are on the way. In the meantime, jump into the practice problems."
                />
            ) : (
                <div className="space-y-12">
                    {[
                        { lane: "SQL" as const, topics: sqlTopics },
                        { lane: "DATA_ENGINEERING" as const, topics: deTopics },
                    ].map(({ lane, topics }) =>
                        topics.length === 0 ? null : (
                            <section key={lane}>
                                <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    {laneLabel(lane)}
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {topics.map((topic: TopicCard) => (
                                        <Link
                                            key={topic.id}
                                            href={`/learn/${topic.slug}`}
                                            className="group"
                                        >
                                            <Card className="h-full transition-[border-color,box-shadow,translate] duration-200 ease-out hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5">
                                                <CardContent className="p-6">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                                            <BookOpen className="h-5 w-5" />
                                                        </div>
                                                        <div className="flex flex-wrap justify-end gap-1.5">
                                                            {topic.articles.length > 0 && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px]"
                                                                >
                                                                    Visual
                                                                </Badge>
                                                            )}
                                                            <Badge variant="secondary">
                                                                {topic._count.articles}{" "}
                                                                {topic._count.articles === 1
                                                                    ? "article"
                                                                    : "articles"}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors">
                                                        {topic.name}
                                                    </h3>
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
                            </section>
                        )
                    )}
                </div>
            )}
        </Container>
    )
}
