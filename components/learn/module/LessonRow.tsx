import Link from "next/link"
import { ChevronRight, Circle, CircleCheck, CircleDot } from "lucide-react"
import type { CurriculumLesson } from "@/lib/curriculum-read"
import type { LessonState } from "@/lib/learn/module-model"
import { cn } from "@/lib/utils"

interface LessonRowProps {
    lesson: CurriculumLesson
    trackSlug: string
    /** 0-indexed position within the module, for the "N. Title" label. */
    index: number
    state: LessonState
}

function StateIcon({ state }: { state: LessonState }) {
    if (state === "done") {
        return <CircleCheck aria-hidden="true" className="size-4 shrink-0 text-primary" />
    }
    if (state === "in-progress") {
        return <CircleDot aria-hidden="true" className="size-4 shrink-0 text-primary" />
    }
    return <Circle aria-hidden="true" className="size-4 shrink-0 text-text-dim" />
}

/**
 * One lesson in the module screen's lesson list. Always a working link,
 * regardless of `mod.unlocked` — see the module page's not-a-gate note.
 */
export function LessonRow({ lesson, trackSlug, index, state }: LessonRowProps) {
    return (
        <li>
            <Link
                href={`/learn/tracks/${trackSlug}/${lesson.slug}`}
                className="group grid grid-cols-[20px_1fr_auto_auto] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-panel-hover"
            >
                <StateIcon state={state} />

                <span className="min-w-0">
                    <span
                        className={cn(
                            "block truncate text-[14.5px] font-medium leading-tight",
                            state === "done"
                                ? "text-text-muted"
                                : "text-foreground group-hover:text-primary",
                        )}
                    >
                        {index + 1}. {lesson.title}
                    </span>
                    {lesson.checkpoints.length > 0 && (
                        <span className="mt-0.5 block font-mono text-[11px] text-text-dim">
                            {lesson.checkpoints.length}{" "}
                            {lesson.checkpoints.length === 1 ? "checkpoint" : "checkpoints"}
                        </span>
                    )}
                </span>

                {/* Always rendered, even when null, so the grid's 4th column
                    (the chevron) stays aligned across rows regardless of
                    which lessons carry a reading estimate. */}
                <span className="font-mono text-[11px] tabular-nums text-text-dim">
                    {lesson.readingMinutes !== null ? `${lesson.readingMinutes}m` : ""}
                </span>

                <ChevronRight
                    className="size-4 text-text-dim transition-colors duration-150 group-hover:text-primary"
                    aria-hidden="true"
                />
            </Link>
        </li>
    )
}
