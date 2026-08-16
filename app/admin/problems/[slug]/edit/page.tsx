import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import type { ProblemStatus } from "@prisma/client"
import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { requireAdminPage } from "@/lib/admin-page-auth"
import { AdminListShell } from "@/components/admin/AdminListShell"
import { StatusPill, type StatusPillStatus } from "@/components/ui/StatusPill"
import { ProblemForm } from "@/components/admin/ProblemForm"

export const metadata = {
    title: "Edit problem",
    robots: { index: false, follow: false },
}

type Props = { params: Promise<{ slug: string }> }

export default async function EditProblemPage({ params }: Props) {
    await requireAdminPage()

    const { slug } = await params
    const problem = await prisma.sQLProblem.findUnique({
        where: { slug },
        include: {
            tags: { select: { slug: true } },
            discussionState: { select: { mode: true } },
            // Task 11 (SP7) — the problem's own checkpoint binding, read
            // straight off the existing `LessonCheckpoint` relation (no new
            // columns). `moduleLessons` is taken 1-deep purely to label the
            // picker with a track/module breadcrumb; an Article can belong
            // to more than one Module, but the checkpoint binding itself is
            // per-problem, not per-placement.
            lessonCheckpoint: {
                select: {
                    position: true,
                    article: {
                        select: {
                            id: true,
                            slug: true,
                            title: true,
                            moduleLessons: {
                                take: 1,
                                orderBy: { position: "asc" },
                                select: {
                                    module: {
                                        select: {
                                            name: true,
                                            track: { select: { name: true, slug: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    })
    if (!problem) notFound()

    const checkpointPlacement = problem.lessonCheckpoint?.article.moduleLessons[0]?.module

    return (
        <AdminListShell
            eyebrow="EDIT"
            title={problem.title}
            description={
                <>
                    <span className="mr-2 font-mono text-[11px] tabular-nums">
                        #{String(problem.number).padStart(3, "0")}
                    </span>
                    Saved via{" "}
                    <code className="font-mono text-xs">
                        PATCH /api/admin/problems/{problem.slug}
                    </code>
                </>
            }
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <ProblemStatusPill status={problem.status} />
                    <BackLink href="/admin/problems" label="Back to problems" />
                </div>
            }
        >
            <ProblemForm
                originalSlug={problem.slug}
                initial={{
                    mode: "edit",
                    title: problem.title,
                    slug: problem.slug,
                    difficulty: problem.difficulty,
                    status: problem.status,
                    description: problem.description,
                    schemaDescription: problem.schemaDescription,
                    ordered: problem.ordered,
                    dialects: problem.dialects ?? ["DUCKDB", "POSTGRES"],
                    hints: problem.hints,
                    tagSlugs: problem.tags.map((t) => t.slug),
                    schemaId: problem.schemaId,
                    discussionMode: problem.discussionState?.mode ?? "OPEN",
                    solutions:
                        (problem.solutions as Record<string, string>) ?? {},
                    expectedOutputs:
                        (problem.expectedOutputs as Record<string, string>) ??
                        {},
                    // Legacy fallbacks — kept for back-compat during v0.4.2
                    // transition. Form initializes per-dialect maps from these
                    // when the new maps are missing entries.
                    expectedOutput: problem.expectedOutput,
                    solutionSql: problem.solutionSql ?? "",
                    curriculumBinding: problem.lessonCheckpoint
                        ? {
                              lessonId: problem.lessonCheckpoint.article.id,
                              lessonSlug: problem.lessonCheckpoint.article.slug,
                              lessonTitle: problem.lessonCheckpoint.article.title,
                              trackName: checkpointPlacement?.track.name ?? null,
                              moduleName: checkpointPlacement?.name ?? null,
                              position: problem.lessonCheckpoint.position,
                          }
                        : null,
                }}
            />
        </AdminListShell>
    )
}

function ProblemStatusPill({ status }: { status: ProblemStatus }) {
    const map: Record<ProblemStatus, { pill: StatusPillStatus; label: string }> = {
        DRAFT: { pill: "draft", label: "draft" },
        BETA: { pill: "pending", label: "beta" },
        PUBLISHED: { pill: "accepted", label: "published" },
        ARCHIVED: { pill: "rejected", label: "archived" },
    }
    const { pill, label } = map[status]
    return <StatusPill status={pill} label={label} />
}

function BackLink({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
            <ChevronLeft className="h-3.5 w-3.5" />
            {label}
        </Link>
    )
}
