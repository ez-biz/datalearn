import type { DayBucket } from "@/lib/profile-stats"
import { cn } from "@/lib/utils"

interface ActivityHeatmapProps {
    series: DayBucket[]
    /** Optional total count for the title row; if omitted, computed. */
    totalSubmissions?: number
}

const CELL_PX = 11
const GAP_PX = 2
const WEEKS = 53

const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]

function intensityClass(count: number): string {
    if (count <= 0) return "fill-surface-muted"
    if (count === 1) return "fill-easy/40"
    if (count <= 3) return "fill-easy/70"
    if (count <= 6) return "fill-easy"
    return "fill-easy [filter:saturate(1.2)]"
}

/**
 * 53-week × 7-day GitHub-style activity heatmap. Server-rendered SVG;
 * each cell carries an aria-label + native title (tooltip) for hover/tap
 * inspection. Pattern + numerical-on-hover satisfies the colorblind a11y
 * fallback called out by the design-intelligence pass.
 */
export function ActivityHeatmap({
    series,
    totalSubmissions,
}: ActivityHeatmapProps) {
    // Pad the start so the grid begins on a Sunday column.
    const firstDay = series[0]
    const firstWeekday = firstDay
        ? new Date(firstDay.date + "T00:00:00Z").getUTCDay()
        : 0
    const padded: (DayBucket | null)[] = [
        ...Array.from({ length: firstWeekday }, () => null),
        ...series,
    ]
    // Trim or pad to exactly WEEKS * 7.
    while (padded.length < WEEKS * 7) padded.push(null)
    if (padded.length > WEEKS * 7) padded.length = WEEKS * 7

    const total =
        totalSubmissions ?? series.reduce((sum, d) => sum + d.count, 0)
    const width = WEEKS * (CELL_PX + GAP_PX)
    const height = 7 * (CELL_PX + GAP_PX) + 18

    // Find month label x-positions: first column where the month changes.
    const monthLabels: Array<{ x: number; label: string }> = []
    let lastMonth = -1
    for (let w = 0; w < WEEKS; w++) {
        const cell = padded[w * 7]
        if (!cell) continue
        const m = new Date(cell.date + "T00:00:00Z").getUTCMonth()
        if (m !== lastMonth) {
            monthLabels.push({
                x: w * (CELL_PX + GAP_PX),
                label: MONTH_NAMES[m],
            })
            lastMonth = m
        }
    }

    return (
        <div>
            <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                <h2 className="text-sm font-semibold tracking-tight">
                    {total.toLocaleString()} submissions in the past year
                </h2>
                <Legend />
            </div>
            <div className="overflow-x-auto scrollbar-thin -mx-1 px-1">
                <svg
                    role="img"
                    aria-label={`Submission activity heatmap, ${total} total submissions in the past 365 days`}
                    width={width}
                    height={height}
                    viewBox={`0 0 ${width} ${height}`}
                    style={{ minWidth: width }}
                >
                    {monthLabels.map((m, i) => (
                        <text
                            key={i}
                            x={m.x}
                            y={10}
                            className="fill-muted-foreground"
                            fontSize="10"
                        >
                            {m.label}
                        </text>
                    ))}
                    {padded.map((day, idx) => {
                        if (!day) return null
                        const week = Math.floor(idx / 7)
                        const dow = idx % 7
                        const x = week * (CELL_PX + GAP_PX)
                        const y = 18 + dow * (CELL_PX + GAP_PX)
                        return (
                            <rect
                                key={day.date}
                                x={x}
                                y={y}
                                width={CELL_PX}
                                height={CELL_PX}
                                rx={2}
                                className={cn(
                                    intensityClass(day.count),
                                    "stroke-border/40"
                                )}
                                strokeWidth={0.5}
                            >
                                <title>
                                    {day.count === 0
                                        ? `No submissions on ${day.date}`
                                        : `${day.count} submission${day.count === 1 ? "" : "s"} on ${day.date}`}
                                </title>
                            </rect>
                        )
                    })}
                </svg>
            </div>
        </div>
    )
}

function Legend() {
    const stops = [0, 1, 2, 5, 10] as const
    return (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
            <span>Less</span>
            {stops.map((n, i) => (
                <span
                    key={i}
                    aria-hidden
                    className={cn(
                        "inline-block h-2.5 w-2.5 rounded-[2px]",
                        n === 0
                            ? "bg-surface-muted"
                            : n === 1
                                ? "bg-easy/40"
                                : n <= 3
                                    ? "bg-easy/70"
                                    : "bg-easy"
                    )}
                />
            ))}
            <span>More</span>
        </div>
    )
}
