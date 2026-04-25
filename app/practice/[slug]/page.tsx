import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getProblem } from "@/actions/problems"
import {
    getProblemHistory,
    getSolvedSlugs,
} from "@/actions/submissions"
import { notFound } from "next/navigation"
import { ProblemClient } from "@/components/practice/ProblemClient"

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

function parseExpectedOutput(raw: string | null | undefined): {
    columns: string[] | null
    sampleRow: Record<string, unknown> | null
} {
    if (!raw) return { columns: null, sampleRow: null }
    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return { columns: null, sampleRow: null }
        }
        const first = parsed[0]
        if (first === null || typeof first !== "object" || Array.isArray(first)) {
            return { columns: null, sampleRow: null }
        }
        return { columns: Object.keys(first), sampleRow: first as Record<string, unknown> }
    } catch {
        return { columns: null, sampleRow: null }
    }
}

export default async function ProblemPage({ params }: Props) {
    const { slug } = await params
    const { data: problem } = await getProblem(slug)

    if (!problem) {
        notFound()
    }

    const [history, solvedSlugs] = await Promise.all([
        getProblemHistory(slug),
        getSolvedSlugs(),
    ])
    const isSolved = solvedSlugs.includes(slug)
    const { columns: expectedColumns, sampleRow: expectedSampleRow } =
        parseExpectedOutput((problem as any).expectedOutput)

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
            <ProblemClient
                title={problem.title}
                slug={problem.slug}
                difficulty={problem.difficulty}
                description={problem.description}
                schemaDescription={problem.schemaDescription}
                schemaSql={problem.schema?.sql ?? null}
                hints={(problem as any).hints ?? []}
                expectedColumns={expectedColumns}
                expectedSampleRow={expectedSampleRow}
                initialHistory={history}
                isSolved={isSolved}
            />
        </div>
    )
}
