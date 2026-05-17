import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { getProblemsByTag } from "@/actions/problems"
import { getSolvedSlugs } from "@/actions/submissions"
import { Container } from "@/components/ui/Container"
import { PracticeList } from "@/components/practice/PracticeList"

interface PageProps {
    params: Promise<{ slug: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { slug } = await params
    const { tag, problems } = await getProblemsByTag(slug)
    if (!tag) {
        return { title: "Tag not found" }
    }
    if (tag.kind === "COMPANY") {
        return {
            title: `${tag.name} SQL interview questions`,
            description: `Practice ${problems.length} SQL ${
                problems.length === 1 ? "problem" : "problems"
            } from ${tag.name} interviews — run queries in your browser and get instant validation.`,
        }
    }
    return {
        title: `${tag.name} SQL problems`,
        description: `Practice ${problems.length} SQL ${
            problems.length === 1 ? "problem" : "problems"
        } tagged "${tag.name}" — run queries in your browser and get instant validation.`,
    }
}

export default async function TagDetailPage({ params }: PageProps) {
    const { slug } = await params
    const [{ tag, problems }, solvedSlugs] = await Promise.all([
        getProblemsByTag(slug),
        getSolvedSlugs(),
    ])

    if (!tag) {
        notFound()
    }

    const solvedCount = problems.filter((p) =>
        solvedSlugs.includes(p.slug),
    ).length
    const isCompany = tag.kind === "COMPANY"

    return (
        <Container width="lg" className="py-10 sm:py-14">
            <header className="mb-8">
                <Link
                    href="/practice/tags"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    All tags
                </Link>
                <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                            {isCompany
                                ? `${tag.name} SQL interview questions`
                                : tag.name}
                        </h1>
                        {isCompany ? (
                            <p className="mt-2 text-muted-foreground">
                                Common SQL questions from {tag.name} interviews.
                            </p>
                        ) : (
                            <p className="mt-2 text-muted-foreground">
                                {problems.length}{" "}
                                {problems.length === 1 ? "problem" : "problems"}{" "}
                                tagged{" "}
                                <span className="text-foreground">
                                    &quot;{tag.name}&quot;
                                </span>
                                .
                            </p>
                        )}
                    </div>
                    {problems.length > 0 && solvedSlugs.length > 0 && (
                        <div className="text-sm text-muted-foreground tabular-nums">
                            <span className="text-foreground font-semibold">
                                {solvedCount}
                            </span>{" "}
                            / {problems.length} solved
                        </div>
                    )}
                </div>
            </header>
            <PracticeList problems={problems} solvedSlugs={solvedSlugs} />
        </Container>
    )
}
