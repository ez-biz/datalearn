import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getProblem } from "@/actions/problems"
import { notFound } from "next/navigation"
import { ProblemWorkspace } from "@/components/sql/ProblemWorkspace"
import { ProblemPanel } from "@/components/practice/ProblemPanel"

type Props = {
    params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    const { data: problem } = await getProblem(slug)
    if (!problem) return { title: "Problem not found" }
    return {
        title: problem.title,
        description: problem.description ?? undefined,
    }
}

export default async function ProblemPage({ params }: Props) {
    const { slug } = await params
    const { data: problem } = await getProblem(slug)

    if (!problem) {
        notFound()
    }

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
            <div className="border-b border-border bg-surface px-4 sm:px-6 py-2.5">
                <Link
                    href="/practice"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    All problems
                </Link>
            </div>
            <div className="flex-1 flex flex-col lg:flex-row min-h-0">
                <aside className="w-full lg:w-2/5 xl:w-1/3 border-b lg:border-b-0 lg:border-r border-border min-h-[40vh] lg:min-h-0">
                    <ProblemPanel
                        title={problem.title}
                        difficulty={problem.difficulty}
                        description={problem.description}
                        schemaDescription={problem.schemaDescription}
                        schemaSql={problem.schema?.sql ?? null}
                    />
                </aside>
                <section className="flex-1 min-h-0 p-3 sm:p-4 bg-background">
                    <ProblemWorkspace
                        initialSql=""
                        schemaSql={problem.schema?.sql}
                        problemSlug={problem.slug}
                    />
                </section>
            </div>
        </div>
    )
}
