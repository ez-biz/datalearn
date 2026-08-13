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
import { LessonSignInNudge } from "@/components/learn/reader/LessonSignInNudge"
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
    // TrackStatus is DRAFT | PUBLISHED | ARCHIVED, so "not PUBLISHED" covers
    // two states and the banner must not call both of them a draft.
    const isUnpublished = curriculum.status !== "PUBLISHED"
    const unpublishedLabel = curriculum.status === "ARCHIVED" ? "Archived" : "Draft"

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

            {/*
                No `min-h-0` on this row, and that is load-bearing. `min-h-0`
                overrides a flex item's `min-height: auto`, which pinned this
                row to the viewport remainder (100dvh - 3rem) while the article
                ran to ~5300px. Two things broke as a result, and neither is
                obvious from a first-viewport screenshot:

                1. Backgrounds paint the BORDER BOX, not the overflow. So
                   <main>'s `bg-panel-raised` and the rails' `bg-panel` and
                   border lines stopped at the first viewport and the article
                   sat on bare `--canvas` below the fold. In dark that is
                   #0E0E11 under #111116 — near-invisible. In LIGHT it is
                   #FAFAFB under a #FFFFFF article: a visible seam and a colour
                   change across the fold, on the flagship screen.
                2. Both rails declare `h-[calc(100dvh-3rem)]` — the row's exact
                   height — so their containing block was the same size as they
                   were and `sticky` had ZERO range. They scrolled away
                   (measured `top: -1952` after a 2000px scroll).

                Without it the row's automatic minimum is its content height:
                #app-scroll scrolls the row instead of <main> overflowing,
                <main> stretches to the whole article so its background paints
                all of it, and the rails get a real sticky range.
            */}
            <div className="flex flex-1">
                <CurriculumRail
                    curriculum={curriculum}
                    currentSlug={lessonSlug}
                    trackSlug={slug}
                    className="sticky top-12 hidden h-[calc(100dvh-3rem)] xl:block"
                />

                <main
                    id="main-content"
                    tabIndex={-1}
                    className="min-w-0 flex-1 bg-panel-raised px-5 pt-8 focus:outline-none sm:px-8 lg:px-14"
                >
                    {isUnpublished && (
                        <p className="mx-auto mb-6 max-w-[76ch] rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-[13px] text-warning-text">
                            {unpublishedLabel} — not visible to learners.
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

                    {/*
                        `pb-24` lives on this column rather than on <main> so
                        the clearance travels with the reading column it
                        protects. It clears the `fixed bottom-0 z-40`
                        ContentsSheet bar, measured at 61px (a 44px button plus
                        2*8px of `p-2` plus the 1px `border-t`) — 96px leaves
                        35px of margin. `lg:pb-14` is plain breathing room,
                        there being no bar at that width.
                    */}
                    <div className="mx-auto w-full max-w-[76ch] pb-24 lg:pb-14">
                        <CheckpointBlock checkpoints={lesson.checkpoints} />
                        <LessonPrevNext trackSlug={slug} prev={prev} next={next} />

                        {/*
                            Below `lg` the aside rail is hidden, and this is a
                            focus route — ConsoleChrome suppresses MobileTabBar
                            and its sign-in slot too — so without this the page
                            has no sign-in affordance at all on a phone. The
                            61px ContentsSheet bar is cleared by this column's
                            `pb-24`, above.
                        */}
                        {!signedIn && (
                            <LessonSignInNudge className="mt-6 lg:hidden" size="lg" />
                        )}
                    </div>
                </main>

                {/*
                    No wrapper: the `hidden ... lg:block` gate lives on the
                    aside's own root. Two gates — one here, one there — would
                    drift the moment either was edited.
                */}
                <LessonAsideRail
                    toc={toc}
                    readingMinutes={lesson.readingMinutes}
                    signedIn={signedIn}
                />
            </div>

            <ContentsSheet
                toc={toc}
                nextHref={next ? `/learn/tracks/${slug}/${next.slug}` : null}
            />
        </ReaderProgressProvider>
    )
}
