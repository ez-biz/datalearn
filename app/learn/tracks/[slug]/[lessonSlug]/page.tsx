import type { Metadata } from "next"
import { cache } from "react"
import { notFound } from "next/navigation"
import { getArticle } from "@/actions/content"
import { getTrackCurriculum } from "@/actions/curriculum"
import { auth } from "@/lib/auth"
import { extractToc } from "@/lib/markdown-toc"
import { CheckpointBlock } from "@/components/learn/reader/CheckpointBlock"
import { ContentsSheet } from "@/components/learn/reader/ContentsSheet"
import { CurriculumRail } from "@/components/learn/reader/CurriculumRail"
import { LessonAsideRail } from "@/components/learn/reader/LessonAsideRail"
import { LessonBody } from "@/components/learn/reader/LessonBody"
import { LessonHeader } from "@/components/learn/reader/LessonHeader"
import { LessonPrevNext } from "@/components/learn/reader/LessonPrevNext"
import { ReaderProgressProvider } from "@/components/learn/reader/ReaderProgressProvider"
import {
    findLesson,
    flattenCurriculum,
    lessonNeighbors,
    modulePrefix,
} from "@/components/learn/reader/lesson-nav"

type Props = {
    params: Promise<{ slug: string; lessonSlug: string }>
}

// Dedup across generateMetadata and the render — both run in the same
// request and would otherwise hit the database twice.
const getCachedArticle = cache(getArticle)
const getCachedCurriculum = cache(getTrackCurriculum)

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { lessonSlug } = await params
    const { data: article } = await getCachedArticle(lessonSlug)
    if (!article) return { title: "Lesson not found" }
    return {
        title: article.title,
        description: article.summary ?? undefined,
        alternates: {
            // The topic route is the canonical address for an article; the
            // reader is the same content in curriculum context.
            canonical: `/learn/${article.topic.slug}/${article.slug}`,
        },
    }
}

/**
 * The lesson reader.
 *
 * This is a FOCUS ROUTE — `components/layout/console/focus-route.ts` matches
 * `/learn/tracks/<track>/<lesson>` and `ConsoleChrome` therefore renders only
 * the `#app-scroll` container: no shell `<header>`, no `<main>`, no
 * `<Footer>`. So this page supplies its own, and `<header>` (inside
 * `LessonHeader`) MUST stay a SIBLING of `<main>`, never a descendant —
 * `<header>` maps to the `banner` landmark only when it is not inside
 * article/aside/main/nav/section, and ARIA forbids `banner` inside `main`.
 *
 * `<main>` carries both `id="main-content"` and `tabIndex={-1}` because the
 * root layout's skip link targets that id and needs a focusable landing.
 */
export default async function LessonPage({ params }: Props) {
    const { slug, lessonSlug } = await params

    const [curriculum, { data: article }, session] = await Promise.all([
        getCachedCurriculum(slug),
        getCachedArticle(lessonSlug),
        auth().catch(() => null),
    ])

    if (!curriculum || !article) notFound()

    const flat = flattenCurriculum(curriculum)
    const lesson = findLesson(flat, lessonSlug)
    // The article exists and the track exists, but this lesson is not part
    // of this track.
    if (!lesson) notFound()

    const { prev, next } = lessonNeighbors(flat, lesson.flatIndex)
    const toc = extractToc(article.content)
    const signedIn = Boolean(session?.user?.id)
    const isDraft = curriculum.status !== "PUBLISHED"

    return (
        <ReaderProgressProvider
            articleSlug={lessonSlug}
            initialPercent={lesson.completed ? 100 : 0}
            signedIn={signedIn}
        >
            <LessonHeader
                trackSlug={slug}
                lesson={lesson}
                total={flat.length}
                prev={prev}
                next={next}
            />

            <div className="flex min-h-0 flex-1">
                <CurriculumRail
                    curriculum={curriculum}
                    currentSlug={lessonSlug}
                    trackSlug={slug}
                    className="sticky top-12 hidden h-[calc(100dvh-3rem)] xl:block"
                />

                <main
                    id="main-content"
                    tabIndex={-1}
                    className="min-w-0 flex-1 bg-panel-raised px-5 pb-24 pt-8 focus:outline-none sm:px-8 lg:px-14 lg:pb-14"
                >
                    {isDraft && (
                        <p className="mx-auto mb-6 max-w-[76ch] rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[13px] text-warning-text">
                            Draft — not visible to learners.
                        </p>
                    )}

                    <LessonBody
                        title={article.title}
                        summary={article.summary}
                        content={article.content}
                        metaSlot={
                            <p className="font-mono text-[11px] uppercase tracking-wider text-primary">
                                Module {modulePrefix(lesson.modulePosition)} · Lesson{" "}
                                {lesson.lessonInModule + 1}
                                {lesson.readingMinutes !== null && (
                                    <span className="text-text-dim">
                                        {" "}| {lesson.readingMinutes} min
                                    </span>
                                )}
                            </p>
                        }
                    />

                    <div className="mx-auto w-full max-w-[76ch]">
                        <CheckpointBlock checkpoints={lesson.checkpoints} />
                        <LessonPrevNext trackSlug={slug} prev={prev} next={next} />
                    </div>
                </main>

                {/*
                    The aside rail is desktop-only, and the breakpoint is not
                    a free choice: ContentsSheet's footer is `lg:hidden`, so
                    `lg` is the exact complement — below it the sheet owns the
                    table of contents, at and above it this rail does. Without
                    this wrapper the rail (which carries no responsive class of
                    its own, unlike CurriculumRail's `xl:block`) keeps its
                    250px at every width: measured on a 390px viewport it
                    squeezed <main> to 140px and the reading column to 100px.

                    `lg:flex` rather than `lg:block` so the wrapper stays a
                    stretching flex parent — the rail scrolls independently via
                    `overflow-y-auto` and needs to inherit the row's full
                    height, which a block wrapper would collapse to content
                    height. `shrink-0` keeps the 250px off the flex shrink
                    budget, exactly as the rail itself intends.
                */}
                <div className="hidden shrink-0 lg:flex">
                    <LessonAsideRail
                        toc={toc}
                        readingMinutes={lesson.readingMinutes}
                        signedIn={signedIn}
                    />
                </div>
            </div>

            <ContentsSheet
                toc={toc}
                nextHref={next ? `/learn/tracks/${slug}/${next.slug}` : null}
            />
        </ReaderProgressProvider>
    )
}
