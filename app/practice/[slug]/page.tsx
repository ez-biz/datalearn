import type { Metadata } from "next"
import { cache } from "react"
import Link from "next/link"
import { ChevronLeft, LockKeyhole } from "lucide-react"
import { getProblem, getSlugByNumber } from "@/actions/problems"
import {
    getProblemHistory,
    getSolvedSlugs,
} from "@/actions/submissions"
import { notFound, redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { ProblemClient } from "@/components/practice/ProblemClient"
import { ReportDialog } from "@/components/practice/ReportDialog"
import { AddToListButton } from "@/components/lists/AddToListButton"
import { parseSchema } from "@/lib/schema-parser"
import { prisma } from "@/lib/prisma"
import { getDiscussionSettings } from "@/lib/discussions/settings"

type Props = {
    params: Promise<{ slug: string }>
}

// Dedup the problem fetch across generateMetadata and the page render —
// both run in the same request and would otherwise hit the DB twice.
const getCachedProblem = cache(getProblem)

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params
    if (/^\d+$/.test(slug)) {
        // Numeric URL → defer to the redirect path; metadata is replaced after redirect.
        return {}
    }
    const { data: problem } = await getCachedProblem(slug)
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

    // `/practice/<n>` shortcut: resolve to the canonical slug and redirect.
    if (/^\d+$/.test(slug)) {
        const target = await getSlugByNumber(Number(slug))
        if (!target) notFound()
        redirect(`/practice/${target}`)
    }

    const { data: problem } = await getCachedProblem(slug)

    if (!problem) {
        notFound()
    }

    const [history, solvedSlugs, session, discussionSettings, discussionState] =
        await Promise.all([
            getProblemHistory(slug),
            getSolvedSlugs(),
            auth(),
            getDiscussionSettings(),
            prisma.problemDiscussionState.findUnique({
                where: { problemId: problem.id },
                select: { mode: true },
            }),
        ])
    const isSolved = solvedSlugs.includes(slug)
    const isSignedIn = Boolean(session?.user?.id)
    const lock = problem.contestLock
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
                <div className="flex items-center gap-4">
                    {lock ? (
                        <span className="text-xs text-muted-foreground">
                            Locked for contest
                        </span>
                    ) : (
                        <AddToListButton
                            problemSlug={problem.slug}
                            problemId={problem.id}
                            isSignedIn={isSignedIn}
                        />
                    )}
                    <ReportDialog problemSlug={problem.slug} isSignedIn={isSignedIn} />
                </div>
            </div>
            {lock && (
                <div className="border-b border-warning/30 bg-warning/5 px-4 sm:px-6 py-2.5 text-sm text-warning">
                    <div className="mx-auto flex max-w-7xl items-center gap-2">
                        <LockKeyhole className="h-4 w-4 shrink-0" />
                        <span>
                            Locked: in contest until{" "}
                            {lock.unlocksAt.toLocaleString()}. Public practice
                            submissions are blocked until then.
                        </span>
                    </div>
                </div>
            )}
            <ProblemClient
                number={problem.number}
                title={problem.title}
                slug={problem.slug}
                difficulty={problem.difficulty}
                description={problem.description}
                schemaDescription={problem.schemaDescription}
                schemaSql={problem.schema?.sql ?? null}
                hints={problem.hints ?? []}
                dialects={problem.dialects ?? ["DUCKDB"]}
                expectedColumns={expectedColumns}
                expectedRows={expectedRows}
                initialHistory={history}
                isSolved={isSolved}
                isSignedIn={isSignedIn}
                viewerUserId={session?.user?.id ?? null}
                discussionEnabled={Boolean(discussionSettings?.globalEnabled)}
                discussionMode={discussionState?.mode ?? "OPEN"}
                initialTableInfos={parseSchema(problem.schema?.sql)}
                relatedArticles={problem.relatedArticles ?? []}
                submissionDisabledReason={
                    lock
                        ? `Public practice submissions are blocked until ${lock.unlocksAt.toLocaleString()}.`
                        : undefined
                }
            />
        </div>
    )
}
