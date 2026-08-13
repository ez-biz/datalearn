"use client"

import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"
import type { CheckpointContext } from "@/lib/workspace/queries"

interface LessonContextBarProps {
    context: CheckpointContext
}

/**
 * Ties a checkpoint problem back to the lesson it came from.
 *
 * Renders only for problems with a LessonCheckpoint — a catalog problem has
 * no lesson, and the caller passes null rather than an empty bar.
 *
 * Note the design's "All problems" reopen button is NOT here: this bar is
 * conditional, so a catalog problem would lose the only way to reopen the
 * problems panel. It lives in WorkspaceLayout instead.
 */
export function LessonContextBar({ context }: LessonContextBarProps) {
    const {
        trackSlug,
        lessonSlug,
        lessonTitle,
        moduleTitle,
        modulePosition,
        index,
        total,
    } = context

    return (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line-soft bg-primary/5 px-4 py-2">
            <Link
                href={`/learn/tracks/${trackSlug}/${lessonSlug}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-primary transition-colors duration-150 hover:text-primary-hover"
            >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Back to lesson
            </Link>

            <p className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-dim">
                <span className="text-text-3">
                    {modulePrefix(modulePosition)} {moduleTitle}
                </span>
                <span aria-hidden> / </span>
                <span className="text-text-2">{lessonTitle}</span>
            </p>

            <div className="flex shrink-0 items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    Checkpoint {index} of {total}
                </span>
                <span
                    className="flex items-center gap-1"
                    role="img"
                    aria-label={`Checkpoint ${index} of ${total}`}
                >
                    {Array.from({ length: total }, (_, i) => (
                        <span
                            key={i}
                            className={cn(
                                "h-[5px] w-[22px] rounded-full",
                                i < index ? "bg-primary" : "bg-line"
                            )}
                        />
                    ))}
                </span>
            </div>
        </div>
    )
}
