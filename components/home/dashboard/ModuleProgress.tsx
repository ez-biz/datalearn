import Link from "next/link"
import type { TrackSummary } from "@/lib/learn/tracks-read"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"

interface ModuleProgressProps {
    /** The dashboard's featured track (HomeData.activeTrack). Its
     *  `modules` field is a per-module rollup computed from rows
     *  getTrackSummariesForUser already fetches — see
     *  lib/learn/tracks-read.ts's ModuleProgressSummary — so this needs no
     *  data beyond what HomeData already carries. */
    activeTrack: TrackSummary | null
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
export function ModuleProgress({ activeTrack }: ModuleProgressProps) {
    if (!activeTrack || activeTrack.modules.length === 0) return null

    return (
        <section>
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Module progress
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {activeTrack.modules.map((module) => (
                    <Link
                        key={module.id}
                        href={`/learn/tracks/${activeTrack.slug}/modules/${module.slug}`}
                        className="rounded-lg border border-border bg-surface p-3 transition-colors duration-150 hover:border-border-strong hover:bg-surface-hover"
                    >
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-[10px] tabular-nums text-text-dim">
                                {modulePrefix(module.position)}
                            </span>
                            <span className="font-mono text-[10px] tabular-nums text-primary">
                                {module.percent}%
                            </span>
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium text-foreground">
                            {module.name}
                        </p>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-panel-sunken">
                            <div
                                className="h-full rounded-full bg-primary transition-[width] duration-300"
                                style={{ width: `${module.percent}%` }}
                            />
                        </div>
                    </Link>
                ))}
            </div>
        </section>
    )
}
