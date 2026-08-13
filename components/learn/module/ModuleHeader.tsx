import { ArrowRight, LockKeyhole } from "lucide-react"
import type { CurriculumModule } from "@/lib/curriculum-read"
import { Container } from "@/components/ui/Container"
import { LinkButton } from "@/components/ui/Button"
import { TrackProgressBar } from "@/components/learn/TrackProgressBar"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

interface ModuleHeaderProps {
    trackSlug: string
    mod: CurriculumModule
    totalModules: number
    /** From `resumeLesson(mod)` — null when the module has no lessons. */
    resumeLessonSlug: string | null
    /** 1-based position of the resume lesson within `mod.lessons`. */
    resumeLessonNumber: number | null
}

/**
 * The module screen's hero: a full-bleed mono breadcrumb bar, then the
 * module identity (eyebrow, locked chip, title, description), the "Resume"
 * CTA, and the rollup bar.
 *
 * `mod.unlocked` is ADVISORY ONLY (see lib/curriculum-progress.ts) — it
 * renders the "Locked until NN" chip below and nothing else. The resume
 * link, and every lesson link the page renders beneath this header, stay
 * live regardless.
 */
export function ModuleHeader({
    trackSlug,
    mod,
    totalModules,
    resumeLessonSlug,
    resumeLessonNumber,
}: ModuleHeaderProps) {
    const { rollup } = mod

    return (
        <header>
            <div className="border-b border-line bg-panel-sunken">
                <Container width="lg" className="flex items-center justify-between gap-3 py-2">
                    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
                        <ol className="flex items-center gap-1.5 truncate font-mono text-[11px] text-text-dim">
                            <li className="truncate">{trackSlug}</li>
                            <li aria-hidden="true">/</li>
                            <li className="truncate text-foreground">{mod.slug}</li>
                        </ol>
                    </nav>
                    <span className="shrink-0 font-mono text-[11px] tabular-nums text-primary">
                        Module {mod.position + 1} of {totalModules}
                    </span>
                </Container>
            </div>

            <Container width="lg" className="py-8 sm:py-10">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                        Module {modulePrefix(mod.position)}
                    </span>
                    {!mod.unlocked && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-panel-raised px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-text-muted">
                            <LockKeyhole className="size-3" aria-hidden="true" />
                            Locked until {modulePrefix(mod.position - 1)}
                        </span>
                    )}
                </div>

                <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                    {mod.name}
                </h1>
                <p className="mt-3 max-w-2xl text-text-muted">{mod.description}</p>

                {resumeLessonSlug && (
                    <LinkButton
                        href={`/learn/tracks/${trackSlug}/${resumeLessonSlug}`}
                        className="mt-5"
                    >
                        Resume lesson {resumeLessonNumber}
                        <ArrowRight className="size-4" aria-hidden="true" />
                    </LinkButton>
                )}

                <TrackProgressBar
                    completedCount={rollup.lessonsDone + rollup.problemsDone}
                    totalCount={rollup.lessonsTotal + rollup.problemsTotal}
                    className="mt-6 max-w-2xl"
                />
            </Container>
        </header>
    )
}
