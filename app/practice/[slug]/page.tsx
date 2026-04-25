import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import { getProblem } from "@/actions/problems"
import {
    getProblemHistory,
    getSolvedSlugs,
} from "@/actions/submissions"
import { notFound } from "next/navigation"
import { auth } from "@/lib/auth"
import { ProblemClient } from "@/components/practice/ProblemClient"
import { ReportDialog } from "@/components/practice/ReportDialog"

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

const EXPECTED_PREVIEW_LIMIT = 8

function parseExpectedOutput(raw: string | null | undefined): {
    columns: string[] | null
    rows: Record<string, unknown>[] | null
} {
    if (!raw) return { columns: null, rows: null }
    try {
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed) || parsed.length === 0) {
            return { columns: null, rows: null }
        }
        const first = parsed[0]
        if (first === null || typeof first !== "object" || Array.isArray(first)) {
            return { columns: null, rows: null }
        }
        const rows = parsed
            .slice(0, EXPECTED_PREVIEW_LIMIT)
            .filter(
                (r: unknown) =>
                    r !== null && typeof r === "object" && !Array.isArray(r)
            ) as Record<string, unknown>[]
        return { columns: Object.keys(first), rows }
    } catch {
        return { columns: null, rows: null }
    }
}

export default async function ProblemPage({ params }: Props) {
    const { slug } = await params
    const { data: problem } = await getProblem(slug)

    if (!problem) {
        notFound()
    }

    const [history, solvedSlugs, session] = await Promise.all([
        getProblemHistory(slug),
        getSolvedSlugs(),
        auth(),
    ])
    const isSolved = solvedSlugs.includes(slug)
    const isSignedIn = Boolean(session?.user?.id)
    const { columns: expectedColumns, rows: expectedRows } =
        parseExpectedOutput(problem.expectedOutput)

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] bg-background">
            <div className="border-b border-border bg-surface px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
                <Link
                    href="/practice"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    All problems
                </Link>
                <ReportDialog problemSlug={problem.slug} isSignedIn={isSignedIn} />
            </div>
            <ProblemClient
                title={problem.title}
                slug={problem.slug}
                difficulty={problem.difficulty}
                description={problem.description}
                schemaDescription={problem.schemaDescription}
                schemaSql={problem.schema?.sql ?? null}
                hints={problem.hints ?? []}
                expectedColumns={expectedColumns}
                expectedRows={expectedRows}
                initialHistory={history}
                isSolved={isSolved}
            />
        </div>
    )
}
