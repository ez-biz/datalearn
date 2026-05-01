interface SolvedDonutProps {
    solved: number
    total: number
    /** User's solved count per difficulty — drives the colored arcs. */
    solvedByDifficulty: { EASY: number; MEDIUM: number; HARD: number }
    /** Total problems per difficulty — shown beside each segment label. */
    totalsByDifficulty: { EASY: number; MEDIUM: number; HARD: number }
}

const SIZE = 168
const STROKE = 14
const RADIUS = SIZE / 2 - STROKE / 2 - 1
const CIRC = 2 * Math.PI * RADIUS

/**
 * Three-segment donut for solved-by-difficulty. Center label shows the
 * ratio; each segment carries an aria-label so a screen reader can read
 * the breakdown without color cues. Stays within the design-intelligence
 * rules: ≤5 categories, percentage text always visible, semantic color
 * tokens (matches existing /practice difficulty badges).
 */
export function SolvedDonut({
    solved,
    total,
    solvedByDifficulty,
    totalsByDifficulty,
}: SolvedDonutProps) {
    const segments = [
        {
            key: "EASY" as const,
            label: "Easy",
            value: solvedByDifficulty.EASY,
            denominator: totalsByDifficulty.EASY,
            colorVar: "var(--color-easy)",
        },
        {
            key: "MEDIUM" as const,
            label: "Medium",
            value: solvedByDifficulty.MEDIUM,
            denominator: totalsByDifficulty.MEDIUM,
            colorVar: "var(--color-medium)",
        },
        {
            key: "HARD" as const,
            label: "Hard",
            value: solvedByDifficulty.HARD,
            denominator: totalsByDifficulty.HARD,
            colorVar: "var(--color-hard)",
        },
    ]
    // Each segment's arc length is proportional to its share of TOTAL
    // (not solved) so the unsolved remainder fills the rest of the ring.
    const safeTotal = Math.max(1, total)
    let offset = 0
    const arcs = segments.map((s) => {
        const portion = s.value / safeTotal
        const length = portion * CIRC
        const dasharray = `${length} ${CIRC - length}`
        const arc = {
            ...s,
            dasharray,
            dashoffset: -offset,
        }
        offset += length
        return arc
    })

    return (
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            <div
                className="relative shrink-0"
                style={{ width: SIZE, height: SIZE }}
            >
                <svg
                    width={SIZE}
                    height={SIZE}
                    viewBox={`0 0 ${SIZE} ${SIZE}`}
                    role="img"
                    aria-label={`${solved} of ${total} problems solved. Easy ${solvedByDifficulty.EASY} of ${totalsByDifficulty.EASY}; Medium ${solvedByDifficulty.MEDIUM} of ${totalsByDifficulty.MEDIUM}; Hard ${solvedByDifficulty.HARD} of ${totalsByDifficulty.HARD}.`}
                >
                    {/* Track */}
                    <circle
                        cx={SIZE / 2}
                        cy={SIZE / 2}
                        r={RADIUS}
                        fill="none"
                        stroke="hsl(var(--surface-muted))"
                        strokeWidth={STROKE}
                    />
                    {/* Segments */}
                    {arcs.map((s) => (
                        <circle
                            key={s.key}
                            cx={SIZE / 2}
                            cy={SIZE / 2}
                            r={RADIUS}
                            fill="none"
                            stroke={s.colorVar}
                            strokeWidth={STROKE}
                            strokeDasharray={s.dasharray}
                            strokeDashoffset={s.dashoffset}
                            strokeLinecap="butt"
                            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                        >
                            <title>
                                {`${s.label}: ${s.value} solved`}
                            </title>
                        </circle>
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-3xl font-semibold tabular-nums leading-none">
                        {solved}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums mt-1">
                        / {total}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mt-2">
                        Solved
                    </div>
                </div>
            </div>
            <ul className="flex-1 space-y-2 text-sm">
                {segments.map((s) => (
                    <li
                        key={s.key}
                        className="flex items-center justify-between gap-3"
                    >
                        <span className="inline-flex items-center gap-2 min-w-0">
                            <span
                                aria-hidden
                                className="h-2.5 w-2.5 rounded-sm shrink-0"
                                style={{ background: s.colorVar }}
                            />
                            <span className="font-medium">{s.label}</span>
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                            {s.value}
                            <span className="text-foreground/40">
                                {" "}
                                / {s.denominator}
                            </span>
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    )
}
