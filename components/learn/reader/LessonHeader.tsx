import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { Logo } from "@/components/ui/Logo"
import type { FlatLesson } from "./lesson-nav"
import { lessonBreadcrumb } from "./lesson-nav"
import { ReadingProgressBar } from "./ReadingProgressBar"

interface LessonHeaderProps {
    trackSlug: string
    lesson: FlatLesson
    total: number
    prev: FlatLesson | null
    next: FlatLesson | null
}

export function LessonHeader({
    trackSlug,
    lesson,
    total,
    prev,
    next,
}: LessonHeaderProps) {
    const crumb = lessonBreadcrumb(trackSlug, lesson)

    return (
        // Direct child of #app-scroll (a plain div), so this maps to the
        // `banner` landmark that ConsoleChrome's <header> provides on every
        // non-focus route. Exactly one banner per page — see Task 4.
        <header className="sticky top-0 z-30 h-12 shrink-0 border-b border-line bg-panel print:hidden">
            <div className="flex h-full items-center gap-3 px-3">
                <Link href={`/learn/tracks/${trackSlug}`} aria-label="Back to track">
                    <Logo iconOnly />
                </Link>

                <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                    <ol className="flex items-center gap-1.5 truncate font-mono text-[11px] text-text-dim">
                        <li className="truncate">{crumb.track}</li>
                        <li aria-hidden="true">/</li>
                        <li className="truncate">{crumb.module}</li>
                        <li aria-hidden="true">/</li>
                        <li className="truncate text-foreground">{crumb.lesson}</li>
                    </ol>
                </nav>

                <span className="hidden font-mono text-[11px] tabular-nums text-text-dim sm:inline">
                    {lesson.flatIndex + 1} / {total}
                </span>

                <div className="flex items-center gap-2">
                    {/*
                        aria-label is required here even though a visible label
                        follows: the "Prev"/"Next" span is `hidden` below `sm`,
                        so at narrow widths the link would otherwise contain
                        only an aria-hidden icon and expose no accessible name.
                        Keep both — the label supplements the visible span, it
                        does not replace it.
                    */}
                    {prev && (
                        <Link
                            href={`/learn/tracks/${trackSlug}/${prev.slug}`}
                            aria-label="Previous lesson"
                            className="inline-flex items-center gap-1 rounded-md border border-line-strong px-2 py-1 font-mono text-[11px] text-text-3 transition-colors duration-150 hover:text-foreground"
                        >
                            <ArrowLeft aria-hidden="true" className="size-3" />
                            <span className="hidden sm:inline">Prev</span>
                        </Link>
                    )}
                    {next && (
                        <Link
                            href={`/learn/tracks/${trackSlug}/${next.slug}`}
                            aria-label="Next lesson"
                            className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-mono text-[11px] text-primary-foreground transition-colors duration-150"
                        >
                            <span className="hidden sm:inline">Next</span>
                            <ArrowRight aria-hidden="true" className="size-3" />
                        </Link>
                    )}
                </div>
            </div>

            <ReadingProgressBar />
        </header>
    )
}
