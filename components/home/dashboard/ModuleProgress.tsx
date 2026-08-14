import Link from "next/link"
import type { CurriculumModule } from "@/lib/curriculum-read"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

interface ModuleProgressProps {
    /** Slug of the track `modules` belongs to, for building module hrefs.
     *  Not derivable from CurriculumModule itself. */
    trackSlug: string
    /**
     * Per-module rollups for the active track, in track order.
     *
     * NOTE for whoever wires this component's real data: `HomeData`
     * (lib/home/home-read.ts) does not currently carry this array —
     * `activeTrack: TrackSummary` (lib/learn/tracks-read.ts) only exposes
     * an aggregate `rollup`, not a per-module breakdown with names. The
     * shape this component asks for already exists elsewhere in the
     * codebase — `TrackCurriculum.modules` (lib/curriculum-read.ts),
     * the same array `components/learn/tracks/TrackProgressCard.tsx`
     * renders from — so the fix is threading that through HomeData (or a
     * second field alongside `activeTrack`), not inventing a new shape.
     * Until that's wired, this component always receives `[]` and
     * correctly renders nothing.
     */
    modules: CurriculumModule[]
}

/**
 * One card per module: number, name, a thin progress bar, and the
 * percentage. Renders one card per module (not hard-capped at six —
 * "six cards" in the design describes the example grid, not a truncation
 * rule; hiding modules past the sixth would be the same silent-data-loss
 * bug this project has already shipped once).
 *
 * Does not render at all when the active track has no modules — not six
 * empty cards. This is production's shape today: zero tracks have modules.
 */
export function ModuleProgress({ trackSlug, modules }: ModuleProgressProps) {
    if (modules.length === 0) return null

    return (
        <section>
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Module progress
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {modules.map((module) => (
                    <Link
                        key={module.id}
                        href={`/learn/tracks/${trackSlug}/modules/${module.slug}`}
                        className="rounded-lg border border-border bg-surface p-3 transition-colors duration-150 hover:border-border-strong hover:bg-surface-hover"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                {modulePrefix(module.position)}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-primary">
                                {module.rollup.percent}%
                            </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-foreground">
                            {module.name}
                        </p>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-panel-sunken">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-300"
                                style={{ width: `${module.rollup.percent}%` }}
                            />
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
