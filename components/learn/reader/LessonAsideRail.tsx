"use client"

import { CircleCheck, Lock } from "lucide-react"
import { LinkButton } from "@/components/ui/Button"
import type { TocEntry } from "@/lib/markdown-toc"
import { cn } from "@/lib/utils"
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
        <aside className="w-[250px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-panel px-3 py-4">
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

            {!signedIn && (
                <section className="rounded-lg border border-dashed border-line-strong p-3">
                    <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                        <Lock aria-hidden="true" className="size-3.5" />
                        Not signed in
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                        Reading is free. Sign in to keep the checkmarks and the
                        streak.
                    </p>
                    <LinkButton href="/auth/signin" className="mt-3 w-full" size="sm">
                        Sign in
                    </LinkButton>
                </section>
            )}
        </aside>
    )
}
