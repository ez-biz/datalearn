"use client"

import { CircleCheck } from "lucide-react"
import type { TocEntry } from "@/lib/markdown-toc"
import { cn } from "@/lib/utils"
import { LessonSignInNudge } from "./LessonSignInNudge"
import { useReaderProgress } from "./ReaderProgressProvider"

interface LessonAsideRailProps {
    toc: TocEntry[]
    readingMinutes: number | null
    signedIn: boolean
    activeSlug?: string
}

export function LessonAsideRail({
    toc,
    readingMinutes,
    signedIn,
    activeSlug,
}: LessonAsideRailProps) {
    // Live, not a prop: the bar in the header and this card must agree.
    const percent = useReaderProgress()
    const completed = percent >= 100
    const minutesLeft =
        readingMinutes === null
            ? null
            : Math.max(0, Math.round(readingMinutes * (1 - percent / 100)))

    return (
        /*
            The `lg` gate lives here rather than on the call site, and the
            breakpoint is not a free choice: `ContentsSheet` is `lg:hidden`,
            so `lg:block` is its exact complement — below it the sheet owns
            the table of contents, at and above it this rail does. Every
            width has exactly one owner, none has zero. Do not "restore" the
            `xl` used by `CurriculumRail`: that would leave the 1024–1280
            band with no Contents at all.

            Ungated, the fixed 250px is held at every width — measured on a
            390px viewport it squeezed <main> to 140px and the reading column
            to 100px.
        */
        <aside className="sticky top-12 hidden h-[calc(100dvh-3rem)] w-[250px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-panel px-3 py-4 lg:block">
            {toc.length > 0 && (
                <nav aria-label="Contents">
                    <h2 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                        Contents
                    </h2>
                    <ul className="max-h-[40vh] overflow-y-auto">
                        {toc.map((entry) => (
                            <li key={entry.slug}>
                                <a
                                    href={`#${entry.slug}`}
                                    className={cn(
                                        "block border-l-2 py-1 pl-2.5 text-[13px] transition-colors duration-150",
                                        entry.level === 3 && "pl-5",
                                        entry.slug === activeSlug
                                            ? "border-l-primary bg-panel-raised text-foreground"
                                            : "border-l-transparent text-text-3 hover:text-foreground",
                                    )}
                                >
                                    {entry.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}

            <section className="rounded-lg border border-line bg-panel-raised p-3">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Lesson state
                </h2>
                {completed && (
                    <p className="mt-2 flex items-center gap-1.5 text-[13px] text-primary-text">
                        <CircleCheck aria-hidden="true" className="size-4" />
                        Auto-completed at 100%
                    </p>
                )}
                <p className="mt-1.5 font-mono text-[11px] tabular-nums text-text-dim">
                    Read {percent}%
                    {minutesLeft !== null && ` · ${minutesLeft} min left`}
                </p>
                <div className="mt-2 h-[3px] rounded-full bg-panel-sunken">
                    <div
                        className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </section>

            {!signedIn && <LessonSignInNudge />}
        </aside>
    )
}
