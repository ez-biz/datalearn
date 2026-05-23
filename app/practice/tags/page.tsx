import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft, Building2, Tag as TagIcon } from "lucide-react"
import { getPublicTags } from "@/actions/problems"
import { Container } from "@/components/ui/Container"
import { Card } from "@/components/ui/Card"
import { Eyebrow } from "@/components/ui/Eyebrow"
import { EmptyState } from "@/components/ui/EmptyState"

const COMPANY_MIN_COUNT = 5
const COMPANY_MIN_PROBLEMS = 3

export const metadata: Metadata = {
    title: "Browse SQL problems by tag",
    description:
        "Explore SQL practice problems grouped by topic — window functions, joins, CTEs, aggregation, and more.",
}
export const dynamic = "force-dynamic"

export default async function TagsIndexPage() {
    const tags = await getPublicTags()
    const companies = tags.filter((t) => t.kind === "COMPANY")
    const topics = tags.filter((t) => t.kind === "TOPIC")
    const showCompanies =
        companies.filter((c) => c.problemCount >= COMPANY_MIN_PROBLEMS)
            .length >= COMPANY_MIN_COUNT

    return (
        <Container width="2xl" className="py-10 sm:py-14">
            <header className="mb-8">
                <Link
                    href="/practice"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All problems
                </Link>
                <Eyebrow variant="bracket" className="mt-4 mb-1">
                    TAGS
                </Eyebrow>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                    Browse by tag
                </h1>
                <p className="mt-2 text-muted-foreground max-w-2xl">
                    Drill into the techniques you want to practice. Each tag
                    groups problems that share the same skill or schema flavor.
                </p>
            </header>

            {tags.length === 0 || topics.length === 0 ? (
                <EmptyState
                    icon={<TagIcon className="h-5 w-5" />}
                    title="No tags yet"
                    description="Tags will appear here once problems are published with them."
                />
            ) : showCompanies ? (
                <div className="space-y-10">
                    <nav className="sticky top-0 z-10 -mx-4 border-b border-border bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-md sm:border">
                        <div className="flex items-center gap-3 text-sm font-medium">
                            <Link
                                href="#companies"
                                className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Companies
                            </Link>
                            <span className="text-border-strong">·</span>
                            <Link
                                href="#topics"
                                className="text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Topics
                            </Link>
                        </div>
                    </nav>

                    <section aria-labelledby="companies">
                        <div className="mb-4">
                            <h2
                                id="companies"
                                className="text-xl font-semibold tracking-tight"
                            >
                                Companies
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Practice SQL question styles associated with
                                common interview loops.
                            </p>
                        </div>
                        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {companies.map((t) => (
                                <li key={t.slug}>
                                    <Link
                                        href={`/practice/tags/${t.slug}`}
                                        className="group block"
                                    >
                                        <Card className="px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                                            <div className="flex items-baseline justify-between gap-3">
                                                <h3 className="flex min-w-0 items-center gap-2 font-semibold text-foreground transition-colors group-hover:text-primary">
                                                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                                                    <span className="truncate">
                                                        {t.name}
                                                    </span>
                                                </h3>
                                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                                    {t.problemCount}{" "}
                                                    {t.problemCount === 1
                                                        ? "problem"
                                                        : "problems"}
                                                </span>
                                            </div>
                                        </Card>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section aria-labelledby="topics">
                        <div className="mb-4">
                            <h2
                                id="topics"
                                className="text-xl font-semibold tracking-tight"
                            >
                                Topics
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Drill into the SQL techniques you want to
                                practice.
                            </p>
                        </div>
                        <TagGrid tags={topics} />
                    </section>
                </div>
            ) : (
                <TagGrid tags={topics} />
            )}
        </Container>
    )
}

function TagGrid({
    tags,
}: {
    tags: Array<{ slug: string; name: string; problemCount: number }>
}) {
    return (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((t) => (
                <li key={t.slug}>
                    <Link
                        href={`/practice/tags/${t.slug}`}
                        className="group block"
                    >
                        <Card className="px-5 py-4 transition-colors hover:border-border-strong hover:bg-surface-muted/40">
                            <div className="flex items-baseline justify-between gap-3">
                                <h2 className="truncate font-semibold text-foreground transition-colors group-hover:text-primary">
                                    {t.name}
                                </h2>
                                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                                    {t.problemCount}{" "}
                                    {t.problemCount === 1
                                        ? "problem"
                                        : "problems"}
                                </span>
                            </div>
                        </Card>
                    </Link>
                </li>
            ))}
        </ul>
    )
}
