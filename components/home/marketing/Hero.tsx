import { ArrowRight } from "lucide-react"
import { LinkButton } from "@/components/ui/Button"

export interface HeroCounts {
    problems: number
    /** Sum of every published track's `lessonsTotal` (lib/learn/tracks-read.ts).
     *  Production ships zero `ModuleLesson` rows today, so this is 0 there —
     *  the whole reason the top strip below has to be able to drop it. */
    lessons: number
    tracks: number
    topics: number
    articles: number
}

interface HeroProps {
    /** First published track (`tracks[0]` from `getTrackSummariesForUser`,
     *  already ordered), or null when nothing is published yet. Null routes
     *  the primary CTA to the tracks index instead of a slug that doesn't
     *  exist — never a dead link. */
    firstTrackSlug: string | null
    counts: HeroCounts
}

/** Clauses for the compact mono strip above the headline, in priority
 *  order. Any clause whose count is 0 is dropped rather than rendered as
 *  "0 lessons" — production has 0 `ModuleLesson` rows, so this strip reads
 *  "39 problems · 3 tracks" there, never "39 problems · 0 lessons · 3
 *  tracks". If every clause were 0 the strip renders nothing at all. */
const STRIP_CLAUSES: Array<{
    key: keyof Pick<HeroCounts, "problems" | "lessons" | "tracks">
    singular: string
    plural: string
}> = [
    { key: "problems", singular: "problem", plural: "problems" },
    { key: "lessons", singular: "lesson", plural: "lessons" },
    { key: "tracks", singular: "track", plural: "tracks" },
]

/** The wider stat row lower in the hero — folds in the old anonymous
 *  page's Problems/Topics/Articles trio (`app/page.tsx`'s retired `Stat`
 *  row) and adds Tracks as a fourth column. Same drop-if-zero rule as the
 *  strip above, applied independently: a tile only renders when its count
 *  is real and non-zero. */
const STAT_TILES: Array<{ key: keyof HeroCounts; label: string }> = [
    { key: "problems", label: "Problems" },
    { key: "topics", label: "Topics" },
    { key: "articles", label: "Articles" },
    { key: "tracks", label: "Tracks" },
]

// Tailwind needs the literal class string present in source to keep it
// through the production build's tree-shake — a template-built
// `grid-cols-${n}` class would silently do nothing. STAT_TILES only ever
// filters down from 4, so 1..4 covers every case.
const STAT_GRID_COLS: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-2 sm:grid-cols-4",
}

/**
 * The signed-out hero's left column: mono stat strip, headline, sub, CTA
 * pair, reassurance line, then the 4-up stat row. The right column
 * (`PathPreview`) is a sibling this component does not own — `app/page.tsx`
 * places both in the same `1fr 470px` grid.
 *
 * The design's primary CTA, "Take the 12-min assessment," is omitted
 * outright — no such feature exists anywhere in the repo (route, action or
 * model). "Start the path" replaces it, linking to the first published
 * track; "Browse problems" (already in the design as the secondary) stays.
 */
export function Hero({ firstTrackSlug, counts }: HeroProps) {
    const stripClauses = STRIP_CLAUSES.filter(({ key }) => counts[key] > 0).map(
        ({ key, singular, plural }) =>
            `${counts[key]} ${counts[key] === 1 ? singular : plural}`
    )
    const statTiles = STAT_TILES.filter(({ key }) => counts[key] > 0)
    const primaryHref = firstTrackSlug
        ? `/learn/tracks/${firstTrackSlug}`
        : "/learn/tracks"

    return (
        <div>
            {stripClauses.length > 0 && (
                <p className="font-mono text-[11px] uppercase tracking-widest text-text-dim tabular-nums">
                    {stripClauses.join(" · ")}
                </p>
            )}

            <h1 className="mt-4 max-w-[17ch] text-[48px] font-semibold leading-[1.08] tracking-[-0.03em] text-foreground">
                Stop collecting tutorials. Follow one ordered path.
            </h1>

            <p className="mt-5 max-w-[56ch] text-[16.5px] leading-[1.6] text-muted-foreground">
                Every lesson sets up the problem it leads to. Write the query
                in your browser, get validated instantly, and move to the
                next link in the chain — instead of picking randomly from a
                pile of tutorials.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <LinkButton href={primaryHref} size="lg">
                    Start the path
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </LinkButton>
                <LinkButton href="/practice" size="lg" variant="outline">
                    Browse problems
                </LinkButton>
            </div>

            <p className="mt-4 font-mono text-[11.5px] text-text-dim">
                Free to read. No card. Progress saves when you sign in.
            </p>

            {statTiles.length > 0 && (
                <dl
                    className={`mt-10 grid max-w-md gap-6 ${STAT_GRID_COLS[statTiles.length] ?? "grid-cols-2"}`}
                >
                    {statTiles.map(({ key, label }) => (
                        <div key={key}>
                            <dt className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                                {label}
                            </dt>
                            <dd className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                                {counts[key]}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </div>
    )
}
