import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import { modulePrefix } from "@/components/learn/reader/lesson-nav"
import { isModuleUnlocked, type ModuleRollup } from "@/lib/curriculum-progress"
import type { TrackSummary } from "@/lib/learn/tracks-read"

interface PathPreviewProps {
    /** `getTrackSummariesForUser(null)` — every published track, anonymous
     *  viewer, already in fetch order. */
    tracks: TrackSummary[]
}

type Tone = "start" | "locked" | "info"

type PreviewRow = {
    key: string
    number: string
    name: string
    description: string
    countText: string
    stateLabel: string
    stateTone: Tone
    href: string
}

const DIFFICULTY_LABEL: Record<string, string> = {
    EASY: "Easy",
    MEDIUM: "Medium",
    HARD: "Hard",
    MIXED: "Mixed",
}

const STATE_TONE_CLASS: Record<Tone, string> = {
    start: "text-primary",
    locked: "text-text-dim",
    info: "text-text-muted",
}

/**
 * Right column of the signed-out hero: a `panel-raised` card previewing
 * "the path" the primary CTA sends you to.
 *
 * Two fallback modes, matching the same track (`tracks[0]`, the one the
 * hero's CTA already links to) so the preview never shows a different path
 * than the button promises:
 *
 *   - `tracks[0]` has modules: preview its modules, in prerequisite order.
 *     This is local dev's shape today (one track, five modules).
 *   - `tracks[0]` has no modules (every published track on production is
 *     still `TrackItem`-based — 0 modules, per the SP6 design spec):
 *     preview the published tracks themselves, with their problem counts.
 *     This is production's shape, and per Task 8's brief, the shape this
 *     component must be seen against first.
 *   - No published tracks at all: renders nothing. There is no honest
 *     fallback for zero tracks — an empty card reads as a claim ("here is
 *     your path") that isn't true.
 *
 * Every module row is signed out, so `getTrackSummariesForUser(null)`
 * reports every module 0% complete — `isModuleUnlocked` (advisory only,
 * never a gate, see lib/curriculum-progress.ts) is therefore true for row
 * 0 and false for every row after it. That's why the footer keeps "Skip
 * ahead anytime" from the design: the locked-looking rows are a hint about
 * order, not an enforced gate.
 */
export function PathPreview({ tracks }: PathPreviewProps) {
    const featured = tracks[0]
    const rows: PreviewRow[] =
        featured && featured.modules.length > 0
            ? moduleRows(featured)
            : tracks.length > 0
              ? trackRows(tracks)
              : []

    if (rows.length === 0) return null

    return (
        <Card className="bg-panel-raised p-5">
            <p className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Your path · preview
            </p>
            <h2 className="mt-1 text-sm font-semibold text-foreground">
                Prerequisite order
            </h2>

            <ul className="mt-4">
                {rows.map((row) => (
                    <li key={row.key}>
                        <Link
                            href={row.href}
                            className="grid grid-cols-[32px_1fr_88px_62px] items-center gap-3 rounded-md px-2 py-2.5 transition-colors duration-150 hover:bg-surface-hover"
                        >
                            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line font-mono text-[10px] tabular-nums text-text-dim">
                                {row.number}
                            </span>
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-medium text-foreground">
                                    {row.name}
                                </span>
                                <span className="block truncate text-[12px] text-text-dim">
                                    {row.description}
                                </span>
                            </span>
                            <span className="text-right font-mono text-[11px] tabular-nums text-text-muted">
                                {row.countText}
                            </span>
                            <span
                                className={cn(
                                    "text-right text-[11px] font-medium",
                                    STATE_TONE_CLASS[row.stateTone]
                                )}
                            >
                                {row.stateLabel}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>

            <Link
                href="/learn/tracks"
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
                Skip ahead anytime →
            </Link>
        </Card>
    )
}

function moduleRows(track: TrackSummary): PreviewRow[] {
    // Minimal ModuleRollup shape for isModuleUnlocked — it only reads
    // `.percent`, so the other fields are filler, not a second source of
    // truth for lesson/problem counts (those come straight off the module
    // summary below).
    const rollups: ModuleRollup[] = track.modules.map((m) => ({
        moduleId: m.id,
        lessonsDone: 0,
        lessonsTotal: 0,
        problemsDone: 0,
        problemsTotal: 0,
        percent: m.percent,
    }))

    return track.modules.map((module, i) => {
        const clauses = [
            module.lessonsTotal > 0 ? `${module.lessonsTotal}L` : null,
            module.problemsTotal > 0 ? `${module.problemsTotal}P` : null,
        ].filter((c): c is string => c !== null)
        const unlocked = isModuleUnlocked(rollups, i)

        return {
            key: module.id,
            number: modulePrefix(module.position),
            name: module.name,
            description: module.description,
            countText: clauses.length > 0 ? clauses.join(" · ") : "—",
            stateLabel: unlocked ? "Start" : "Locked",
            stateTone: unlocked ? "start" : "locked",
            href: `/learn/tracks/${track.slug}/modules/${module.slug}`,
        }
    })
}

function trackRows(tracks: TrackSummary[]): PreviewRow[] {
    return tracks.map((track, i) => ({
        key: track.slug,
        number: modulePrefix(i),
        name: track.name,
        description: track.summary,
        // lessonsTotal is always 0 here by construction — this branch only
        // runs when tracks[0] (and every track sharing this render) has no
        // modules, so there is never a "0 lessons" clause to drop.
        countText: track.problemsTotal > 0 ? `${track.problemsTotal}P` : "—",
        // Tracks aren't prerequisite-gated the way modules within one track
        // are — nothing stops a learner from starting track 2 first, so
        // calling it "Locked" would be false. Difficulty is real, sourced
        // data instead.
        stateLabel:
            i === 0 ? "Start" : (DIFFICULTY_LABEL[track.difficulty] ?? track.difficulty),
        stateTone: i === 0 ? "start" : "info",
        href: `/learn/tracks/${track.slug}`,
    }))
}
