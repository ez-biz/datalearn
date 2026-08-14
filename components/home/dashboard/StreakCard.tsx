import { Flame } from "lucide-react"
import { Card } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import type { DayBucket, StreakInfo } from "@/lib/profile-stats"

interface StreakCardProps {
    streak: StreakInfo
    /** Exactly 7 buckets, oldest first — the trailing week of `streak`'s
     *  own 365-day series (see lib/home/home-read.ts), never a second,
     *  independently-queried source. */
    week: DayBucket[]
}

function tintFor(count: number): string {
    if (count <= 0) return "bg-panel-sunken"
    if (count === 1) return "bg-primary/35"
    if (count <= 3) return "bg-primary/65"
    return "bg-primary"
}

/**
 * The headline (`streak.current`) and the 7-square grid (`week`)
 * deliberately measure different windows: `current` spans the same
 * 365-day series /profile uses, so it agrees with /profile for the same
 * user; `week` is just the trailing 7 days of that same series, for a
 * compact glance. A 30-day streak correctly shows "30" above seven filled
 * squares — never recompute the headline from `week`, which would silently
 * cap it at 7.
 */
export function StreakCard({ streak, week }: StreakCardProps) {
    return (
        <Card className="p-5">
            <div className="flex items-center justify-between">
                <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                    Streak
                </h2>
                <Flame
                    aria-hidden="true"
                    className={cn(
                        "h-4 w-4",
                        streak.current > 0 ? "text-accent" : "text-muted-foreground"
                    )}
                />
            </div>

            <div className="mt-2 flex items-baseline gap-2">
                <span className="text-[28px] font-semibold tabular-nums text-foreground">
                    {streak.current}
                </span>
                <span className="text-sm text-muted-foreground">day streak</span>
            </div>
            {streak.longest > streak.current && (
                <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
                    Best: {streak.longest}
                </p>
            )}

            <p className="mt-4 font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Last 7 days
            </p>
            <div className="mt-2 grid grid-cols-7 gap-1.5">
                {week.map((day) => (
                    <div
                        key={day.date}
                        title={`${day.count} submission${day.count === 1 ? "" : "s"} on ${day.date}`}
                        className={cn("h-[26px] w-[26px] rounded-[4px]", tintFor(day.count))}
                    />
                ))}
            </div>
        </Card>
    )
}
