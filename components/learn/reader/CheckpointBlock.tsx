import Link from "next/link"
import { ChevronRight, Circle, CircleCheck } from "lucide-react"
import type { CurriculumCheckpoint } from "@/lib/curriculum-read"
import { cn } from "@/lib/utils"

const DIFFICULTY_STYLE: Record<CurriculumCheckpoint["difficulty"], string> = {
    EASY: "text-easy",
    MEDIUM: "text-medium",
    HARD: "text-hard",
}

interface CheckpointBlockProps {
    checkpoints: CurriculumCheckpoint[]
}

export function CheckpointBlock({ checkpoints }: CheckpointBlockProps) {
    // 4 of the 17 seeded lessons have no checkpoint. They get nothing —
    // an empty card would be worse than silence.
    if (checkpoints.length === 0) return null

    return (
        <section
            aria-label="Checkpoint"
            className="mt-10 rounded-lg border border-primary-border bg-primary-bg"
        >
            <div className="flex items-center justify-between border-b border-primary-border px-4 py-2.5">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-primary-text">
                    Checkpoint · {checkpoints.length}{" "}
                    {checkpoints.length === 1 ? "problem" : "problems"}
                </h2>
                <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    Counts toward track
                </span>
            </div>

            <ul className="p-2">
                {checkpoints.map((checkpoint) => (
                    <li key={checkpoint.problemId}>
                        <Link
                            href={`/practice/${checkpoint.slug}`}
                            className="grid min-h-11 grid-cols-[16px_1fr_auto_16px] items-center gap-3 rounded-md px-2 py-2 transition-colors duration-150 hover:bg-panel-hover"
                        >
                            {checkpoint.solved ? (
                                <CircleCheck aria-hidden="true" className="size-4 text-icon-done" />
                            ) : (
                                <Circle aria-hidden="true" className="size-4 text-icon-off" />
                            )}
                            <span className="text-sm text-foreground">
                                {checkpoint.number}. {checkpoint.title}
                            </span>
                            <span
                                className={cn(
                                    "font-mono text-[10px] uppercase tracking-wider",
                                    DIFFICULTY_STYLE[checkpoint.difficulty],
                                )}
                            >
                                {checkpoint.difficulty}
                            </span>
                            <ChevronRight aria-hidden="true" className="size-4 text-text-dim" />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}
