import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Tag as TagIcon } from "lucide-react"
import { getPublicTags } from "@/actions/problems"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"

export const metadata: Metadata = {
    title: "Browse SQL problems by tag",
    description:
        "Explore SQL practice problems grouped by topic — window functions, joins, CTEs, aggregation, and more.",
}

export default async function TagsIndexPage() {
    const tags = await getPublicTags()

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8">
                <Link
                    href="/practice"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All problems
                </Link>
                <h1 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight">
                    Browse by tag
                </h1>
                <p className="mt-2 text-muted-foreground max-w-2xl">
                    Drill into the techniques you want to practice. Each tag groups
                    problems that share the same skill or schema flavor.
                </p>
            </header>

            {tags.length === 0 ? (
                <EmptyState
                    icon={<TagIcon className="h-5 w-5" />}
                    title="No tags yet"
                    description="Tags will appear here once problems are published with them."
                />
            ) : (
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {tags.map((t) => (
                        <li key={t.slug}>
                            <Link
                                href={`/practice/tags/${t.slug}`}
                                className="block group"
                            >
                                <Card className="px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <h2 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                            {t.name}
                                        </h2>
                                        <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                                            {t.problemCount}{" "}
                                            {t.problemCount === 1 ? "problem" : "problems"}
                                        </span>
                                    </div>
                                </Card>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Container>
    )
}
