import Link from "next/link"
import { Circle, CircleCheck } from "lucide-react"
import type { CurriculumModule } from "@/lib/curriculum-read"
import type { ModuleFacts } from "@/lib/learn/module-model"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

interface ModuleRailProps {
    trackSlug: string
    /** Modules earlier in the track than the one being viewed, track order. */
    earlierModules: CurriculumModule[]
    facts: ModuleFacts
}

/**
 * The module screen's right rail: Prerequisites (earlier modules, checked
 * off once their own rollup reaches 100%) and the module's aggregate facts.
 * Purely presentational — every earlier module stays a normal link
 * regardless of completion, matching the "never a gate" rule.
 */
export function ModuleRail({ trackSlug, earlierModules, facts }: ModuleRailProps) {
    return (
        <aside className="space-y-4 lg:sticky lg:top-6">
            <section className="rounded-lg border border-line bg-panel-raised p-4">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Prerequisites
                </h2>
                {earlierModules.length === 0 ? (
                    <p className="mt-2 text-[13px] text-text-3">
                        First module in the track — nothing to complete first.
                    </p>
                ) : (
                    <ul className="mt-3 space-y-2">
                        {earlierModules.map((m) => {
                            const done = m.rollup.percent === 100
                            return (
                                <li key={m.id}>
                                    <Link
                                        href={`/learn/tracks/${trackSlug}/modules/${m.slug}`}
                                        className="flex items-center gap-2 text-[13px] text-text-2 transition-colors duration-150 hover:text-foreground"
                                    >
                                        {done ? (
                                            <CircleCheck
                                                aria-hidden="true"
                                                className="size-4 shrink-0 text-primary"
                                            />
                                        ) : (
                                            <Circle
                                                aria-hidden="true"
                                                className="size-4 shrink-0 text-text-dim"
                                            />
                                        )}
                                        <span className="truncate">
                                            {modulePrefix(m.position)} · {m.name}
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                )}
            </section>

            <section className="rounded-lg border border-line bg-panel-raised p-4">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                    Module facts
                </h2>
                <dl className="mt-3 space-y-2 text-[13px]">
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-text-3">Reading time</dt>
                        <dd className="font-mono tabular-nums text-text-2">
                            {facts.readingMinutes} min
                        </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <dt className="text-text-3">Problems</dt>
                        <dd className="font-mono tabular-nums text-text-2">
                            {facts.problemCount}
                        </dd>
                    </div>
                </dl>
            </section>
        </aside>
    )
}
