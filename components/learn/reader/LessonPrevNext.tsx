import Link from "next/link"
import type { FlatLesson } from "./lesson-nav"

interface LessonPrevNextProps {
    trackSlug: string
    prev: FlatLesson | null
    next: FlatLesson | null
}

export function LessonPrevNext({ trackSlug, prev, next }: LessonPrevNextProps) {
    if (!prev && !next) return null

    return (
        <nav
            aria-label="Lesson navigation"
            className="mt-10 grid gap-3 sm:grid-cols-2"
        >
            {prev ? (
                <Link
                    href={`/learn/tracks/${trackSlug}/${prev.slug}`}
                    className="rounded-lg border border-line bg-panel-raised p-4 transition-colors duration-150 hover:border-line-strong"
                >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        ← Previous
                    </span>
                    <p className="mt-1 text-sm text-foreground">{prev.title}</p>
                </Link>
            ) : (
                // Keeps the next card in the right-hand column on the first
                // lesson, rather than letting it slide left.
                <div aria-hidden="true" className="hidden sm:block" />
            )}

            {next && (
                <Link
                    href={`/learn/tracks/${trackSlug}/${next.slug}`}
                    className="rounded-lg border border-primary-border bg-primary-bg p-4 text-right transition-colors duration-150 hover:border-primary"
                >
                    <span className="font-mono text-[10px] uppercase tracking-wider text-primary-text">
                        Next →
                    </span>
                    <p className="mt-1 text-sm text-foreground">{next.title}</p>
                </Link>
            )}
        </nav>
    )
}
