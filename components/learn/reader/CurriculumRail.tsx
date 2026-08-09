import Link from "next/link"
import { Circle, CircleCheck, CircleDot } from "lucide-react"
import type { TrackCurriculum } from "@/lib/curriculum-read"
import { cn } from "@/lib/utils"
import { modulePrefix } from "./lesson-nav"

interface CurriculumRailProps {
    curriculum: TrackCurriculum
    currentSlug: string
    trackSlug: string
    className?: string
}

function StateIcon({ done, current }: { done: boolean; current: boolean }) {
    if (current) {
        return <CircleDot aria-hidden="true" className="size-4 text-primary" />
    }
    if (done) {
        return <CircleCheck aria-hidden="true" className="size-4 text-icon-done" />
    }
    return <Circle aria-hidden="true" className="size-4 text-icon-off" />
}

export function CurriculumRail({
    curriculum,
    currentSlug,
    trackSlug,
    className,
}: CurriculumRailProps) {
    // One article may appear in two modules of the same track. findLesson
    // resolves such a slug to the occurrence in the LOWEST module position;
    // the rail must highlight that same occurrence, or a cross-listed lesson
    // lights up two module headers with two different n/m fractions and
    // announces "current page" twice. `modules` arrives ordered by position,
    // so the first match is the lowest.
    const currentModuleId =
        curriculum.modules.find((mod) =>
            mod.lessons.some((lesson) => lesson.slug === currentSlug),
        )?.id ?? null

    return (
        <nav
            aria-label="Curriculum"
            className={cn(
                "w-[270px] shrink-0 overflow-y-auto border-r border-line bg-panel",
                className,
            )}
        >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Curriculum
                </span>
                <span className="font-mono text-[11px] tabular-nums text-primary">
                    {curriculum.rollup.percent}%
                </span>
            </div>

            <ol className="py-2">
                {curriculum.modules.map((mod) => (
                    <li key={mod.id}>
                        <div className="flex items-center justify-between px-4 pb-1 pt-4">
                            <span
                                className={cn(
                                    "font-mono text-[10px] uppercase tracking-wider",
                                    mod.id === currentModuleId
                                        ? "text-primary"
                                        : "text-text-dim",
                                )}
                            >
                                {modulePrefix(mod.position)} · {mod.name}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                {mod.rollup.lessonsDone}/{mod.rollup.lessonsTotal}
                            </span>
                        </div>

                        <ul>
                            {mod.lessons.map((lesson) => {
                                const current =
                                    lesson.slug === currentSlug &&
                                    mod.id === currentModuleId
                                return (
                                    <li key={`${mod.id}-${lesson.articleId}`}>
                                        <Link
                                            href={`/learn/tracks/${trackSlug}/${lesson.slug}`}
                                            aria-current={current ? "page" : undefined}
                                            className={cn(
                                                "grid grid-cols-[16px_1fr_auto] items-center gap-2.5 border-l-2 py-1.5 pl-3.5 pr-4 transition-colors duration-150",
                                                current
                                                    ? "border-l-primary bg-primary-row"
                                                    : "border-l-transparent hover:bg-panel-hover",
                                            )}
                                        >
                                            <StateIcon
                                                done={lesson.completed}
                                                current={current}
                                            />
                                            <span
                                                className={cn(
                                                    "text-[13px] leading-snug",
                                                    current ? "text-foreground" : "text-text-3",
                                                )}
                                            >
                                                {lesson.title}
                                            </span>
                                            {lesson.readingMinutes !== null && (
                                                <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                                    {lesson.readingMinutes}m
                                                </span>
                                            )}
                                        </Link>
                                    </li>
                                )
                            })}
                        </ul>
                    </li>
                ))}
            </ol>
        </nav>
    )
}
