import Link from "next/link"
import { Circle, CircleCheck, CircleDot, LockKeyhole } from "lucide-react"
import type { CurriculumModule } from "@/lib/curriculum-read"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

interface ModuleRowProps {
    mod: CurriculumModule
    trackSlug: string
}

/**
 * One row of the track detail's Curriculum list: `grid 34px 1fr 110px 130px
 * 90px` — number chip, name + description, lesson/problem counts, a
 * progress bar + percentage, and a state chip. The whole row links to the
 * Task 6 module screen (`/learn/tracks/<track>/modules/<module>`).
 *
 * `mod.unlocked` is ADVISORY ONLY (lib/curriculum-progress.ts). A locked
 * module still renders as a fully working link — locked only swaps the
 * state chip's icon/label, matching the module screen and CLAUDE.md's
 * "never enforce module unlocking" rule.
 */
export function ModuleRow({ mod, trackSlug }: ModuleRowProps) {
    const { rollup } = mod
    const isDone = rollup.percent === 100
    const isStarted = rollup.percent > 0

    return (
        <Link
            href={`/learn/tracks/${trackSlug}/modules/${mod.slug}`}
            className="group grid grid-cols-[34px_1fr_110px_130px_90px] items-center gap-3 px-4 py-3 transition-colors duration-150 hover:bg-panel-hover"
        >
            <span
                aria-hidden="true"
                className="flex h-[34px] w-[34px] items-center justify-center rounded-md border border-line bg-panel-sunken font-mono text-[11px] tabular-nums text-text-dim"
            >
                {modulePrefix(mod.position)}
            </span>

            <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-medium leading-tight text-foreground group-hover:text-primary">
                    {mod.name}
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">
                    {mod.description}
                </span>
            </span>

            <span className="flex flex-col justify-center gap-0.5 font-mono text-[11px] tabular-nums text-text-dim">
                <span>
                    {rollup.lessonsTotal}{" "}
                    {rollup.lessonsTotal === 1 ? "lesson" : "lessons"}
                </span>
                <span>
                    {rollup.problemsTotal}{" "}
                    {rollup.problemsTotal === 1 ? "problem" : "problems"}
                </span>
            </span>

            <span className="flex items-center gap-2">
                <span
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-sunken"
                    role="progressbar"
                    aria-label={`${mod.name} progress`}
                    aria-valuenow={rollup.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                >
                    <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-300"
                        style={{ width: `${rollup.percent}%` }}
                    />
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-primary">
                    {rollup.percent}%
                </span>
            </span>

            <span className="flex items-center justify-end gap-1.5 font-mono text-[10px] uppercase tracking-wider">
                {isDone ? (
                    <>
                        <CircleCheck
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                        />
                        <span className="text-text-muted">Done</span>
                    </>
                ) : !mod.unlocked ? (
                    <>
                        <LockKeyhole
                            className="size-3.5 text-text-dim"
                            aria-hidden="true"
                        />
                        <span className="text-text-dim">Locked</span>
                    </>
                ) : isStarted ? (
                    <>
                        <CircleDot
                            className="size-3.5 text-primary"
                            aria-hidden="true"
                        />
                        <span className="text-text-muted">Active</span>
                    </>
                ) : (
                    <>
                        <Circle
                            className="size-3.5 text-text-dim"
                            aria-hidden="true"
                        />
                        <span className="text-text-dim">Open</span>
                    </>
                )}
            </span>
        </Link>
    )
}
