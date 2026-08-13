import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { ArrowRight, LockKeyhole } from "lucide-react"
import { auth } from "@/lib/auth"
import {
    getTrackCurriculumForUser,
    type CurriculumCheckpoint,
    type CurriculumModule,
} from "@/lib/curriculum-read"
import type { ModuleRollup } from "@/lib/curriculum-progress"
import type { CatalogProblem } from "@/lib/practice/catalog-read"
import { lessonState, moduleFacts, resumeLesson } from "@/lib/learn/module-model"
import { CatalogRow } from "@/components/practice/catalog/CatalogRow"
import { Container } from "@/components/ui/Container"
import { LinkButton } from "@/components/ui/Button"
import { ModuleHeader } from "@/components/learn/module/ModuleHeader"
import { LessonRow } from "@/components/learn/module/LessonRow"
import { ModuleRail } from "@/components/learn/module/ModuleRail"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

type Props = {
    params: Promise<{ slug: string; moduleSlug: string }>
}

export const dynamic = "force-dynamic"

// All-primitive args (no options object) so React's cache() memoizes
// correctly across generateMetadata and the page render — both run in the
// same request and would otherwise hit the database twice. A literal
// `{ allowDraft }` object would break memoization: cache() keys on the
// reference identity of non-primitive args, and two call sites never share
// one object literal.
const getCachedCurriculum = cache(
    (trackSlug: string, userId: string | null, allowDraft: boolean) =>
        getTrackCurriculumForUser(trackSlug, userId, { allowDraft }),
)

async function resolveViewer() {
    const session = await auth().catch(() => null)
    const userId = session?.user?.id ?? null
    // Same ADMIN/MODERATOR staff gate as app/practice/[slug]/page.tsx and
    // the lesson reader — staff preview DRAFT tracks, learners 404 on them.
    const isStaff =
        session?.user?.role === "ADMIN" || session?.user?.role === "MODERATOR"
    return { userId, isStaff }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug, moduleSlug } = await params
    const { userId, isStaff } = await resolveViewer()
    const curriculum = await getCachedCurriculum(slug, userId, isStaff)
    const mod = curriculum?.modules.find((m) => m.slug === moduleSlug)
    if (!curriculum || !mod) return { title: "Module not found" }
    return {
        title: `${mod.name} · ${curriculum.name}`,
        description: mod.description || undefined,
    }
}

/**
 * A checkpoint carries only what the reader/rail need
 * (`lib/curriculum-read.ts`'s `CurriculumCheckpoint`), which is narrower
 * than `CatalogProblem` — no tags, no dialects, no pass-rate counters. Per
 * the task brief: don't widen `CatalogProblem` or fetch the whole catalog
 * just to attach a module's problems to `CatalogRow`; map what's on hand
 * and let the `compact` variant render only the columns it can.
 *
 * One real gap this leaves: `CatalogProblem.attempted` distinguishes "tried,
 * not yet solved" from "never tried", but a curriculum checkpoint only ever
 * carries `solved`. An unsolved checkpoint therefore always renders as
 * "not attempted" here, even if the viewer has actually tried and failed —
 * `attempted: checkpoint.solved` is the honest floor given the data we have.
 *
 * `description` is `""` for the same reason: `CurriculumCheckpoint` doesn't
 * carry a problem's body text, and this module screen has no search box —
 * `matchesSearch` (lib/practice/catalog-model.ts) is never run against
 * these rows, and `CatalogRow` never renders the field either.
 */
function toCatalogProblem(
    checkpoint: CurriculumCheckpoint,
    mod: Pick<CurriculumModule, "id" | "position" | "name">,
): CatalogProblem {
    return {
        number: checkpoint.number,
        slug: checkpoint.slug,
        title: checkpoint.title,
        description: "",
        difficulty: checkpoint.difficulty,
        solved: checkpoint.solved,
        attempted: checkpoint.solved,
        moduleId: mod.id,
        modulePosition: mod.position,
        moduleTitle: mod.name,
        topicTags: [],
        companyTags: [],
        dialects: [],
        attemptCount: 0,
        acceptedCount: 0,
        createdAt: new Date(0),
    }
}

/**
 * A module's checkpoints, deduped by problem. `LessonCheckpoint` carries
 * `@@unique([problemId])` (prisma/schema.prisma) — a problem is checkpointed
 * by at most one lesson anywhere in the app, so today this can never find a
 * duplicate. Kept anyway as a defensive floor: if that constraint is ever
 * relaxed, `CatalogRow`'s `key={problem.slug}` below stays collision-free
 * without this file needing to know why.
 */
function dedupeByProblem(checkpoints: CurriculumCheckpoint[]): CurriculumCheckpoint[] {
    const seen = new Set<string>()
    const result: CurriculumCheckpoint[] = []
    for (const checkpoint of checkpoints) {
        if (seen.has(checkpoint.problemId)) continue
        seen.add(checkpoint.problemId)
        result.push(checkpoint)
    }
    return result
}

/**
 * The module screen. A normal shell route (5 segments — see
 * components/layout/console/focus-route.ts and its test coverage), so
 * unlike the lesson reader this needs no bespoke <header>/<main> pair;
 * ConsoleChrome supplies both.
 *
 * Everything below the breadcrumb bar — hero, Lessons, Attached problems —
 * lives in ONE `1fr 340px` grid, per the design spec: the hero is not a
 * banner sitting above the grid, it's the top of the grid's left column, so
 * `ModuleRail` runs alongside it too, not just alongside the lesson list.
 *
 * `mod.unlocked` is ADVISORY ONLY (lib/curriculum-progress.ts). It drives
 * the "Locked until NN" chip in the hero and nothing else — every lesson
 * below renders as a working link and the route itself never checks it,
 * matching CLAUDE.md's "never enforce module unlocking" rule.
 */
export default async function ModulePage({ params }: Props) {
    const { slug, moduleSlug } = await params
    const { userId, isStaff } = await resolveViewer()

    const curriculum = await getCachedCurriculum(slug, userId, isStaff)
    if (!curriculum) notFound()

    const mod = curriculum.modules.find((m) => m.slug === moduleSlug)
    if (!mod) notFound()

    const resume = resumeLesson(mod)
    const resumeIndex = resume
        ? mod.lessons.findIndex((l) => l.articleId === resume.articleId)
        : -1

    const facts = moduleFacts(mod)
    const earlierModules = curriculum.modules.filter((m) => m.position < mod.position)

    const attachedProblems = dedupeByProblem(
        mod.lessons.flatMap((l) => l.checkpoints),
    ).map((checkpoint) => toCatalogProblem(checkpoint, mod))

    return (
        <>
            <ModuleHeader trackSlug={slug} mod={mod} totalModules={curriculum.modules.length} />

            <Container width="lg" className="py-8 pb-14 sm:py-10 sm:pb-20">
                <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                                Module {modulePrefix(mod.position)}
                            </span>
                            {!mod.unlocked && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-panel-raised px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                                    <LockKeyhole className="size-3" aria-hidden="true" />
                                    Locked until {modulePrefix(mod.position - 1)}
                                </span>
                            )}
                        </div>

                        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                            {mod.name}
                        </h1>
                        <p className="mt-3 max-w-[62ch] text-text-muted">{mod.description}</p>

                        {resume && (
                            <LinkButton
                                href={`/learn/tracks/${slug}/${resume.slug}`}
                                className="mt-5"
                            >
                                Resume lesson {resumeIndex + 1}
                                <ArrowRight className="size-4" aria-hidden="true" />
                            </LinkButton>
                        )}

                        <ModuleProgressBar rollup={mod.rollup} className="mt-6 max-w-2xl" />

                        <h2 className="mb-3 mt-10 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            Lessons · {mod.lessons.length}
                        </h2>
                        {mod.lessons.length === 0 ? (
                            <p className="text-sm text-text-muted">
                                No lessons in this module yet.
                            </p>
                        ) : (
                            <ol className="divide-y divide-line-faint rounded-lg border border-line">
                                {mod.lessons.map((lesson, index) => (
                                    <LessonRow
                                        key={lesson.articleId}
                                        lesson={lesson}
                                        trackSlug={slug}
                                        index={index}
                                        state={lessonState(
                                            lesson,
                                            resume?.articleId === lesson.articleId,
                                        )}
                                    />
                                ))}
                            </ol>
                        )}

                        {attachedProblems.length > 0 && (
                            <section className="mt-8" aria-labelledby="module-problems-heading">
                                <h2
                                    id="module-problems-heading"
                                    className="mb-3 font-mono text-[10px] uppercase tracking-wider text-text-muted"
                                >
                                    Problems in this module · {attachedProblems.length}
                                </h2>
                                {/* CatalogTable owns the catalog's horizontal-scroll
                                    container, and it is catalog-only — this compact
                                    list needs its own, per Task 3's handoff note, so
                                    the fixed-width compact row (min-w-[360px]) scrolls
                                    instead of clipping on a narrow viewport. */}
                                <div
                                    role="table"
                                    aria-label="Module problems"
                                    className="overflow-x-auto rounded-lg border border-line-soft"
                                >
                                    <div role="rowgroup" className="divide-y divide-line-faint">
                                        {attachedProblems.map((problem) => (
                                            <CatalogRow key={problem.slug} problem={problem} compact />
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>

                    <ModuleRail
                        trackSlug={slug}
                        earlierModules={earlierModules}
                        facts={facts}
                    />
                </div>
            </Container>
        </>
    )
}

/**
 * The hero's rollup bar. Unlike the generic `TrackProgressBar` (a single
 * "X / Y complete"), the spec requires lessons and problems stay two
 * separately-readable counts — summing them into one figure would let a
 * module with 5/5 lessons done but 0/5 problems done read as "50%
 * complete" with no way to tell which half is finished. One bar, two
 * counts in its label; `rollup.percent` (already lessons+problems combined)
 * still drives the fill width and the standalone `NN%`.
 */
function ModuleProgressBar({ rollup, className }: { rollup: ModuleRollup; className?: string }) {
    return (
        <div className={className}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[13px]">
                <span className="font-medium tabular-nums text-text-2">
                    {rollup.lessonsDone} of {rollup.lessonsTotal} lessons · {rollup.problemsDone}{" "}
                    of {rollup.problemsTotal} problems
                </span>
                <span className="font-mono text-[11px] tabular-nums text-primary">
                    {rollup.percent}%
                </span>
            </div>
            <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-panel-sunken"
                role="progressbar"
                aria-label="Module progress"
                aria-valuenow={rollup.percent}
                aria-valuemin={0}
                aria-valuemax={100}
            >
                <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${rollup.percent}%` }}
                />
            </div>
        </div>
    )
}
