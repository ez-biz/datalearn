import Link from "next/link"
import { Card } from "@/components/ui/Card"
import { cn } from "@/lib/utils"
import type { WeakSpot } from "@/lib/home/weak-spots"

interface WeakSpotsCardProps {
    weakSpots: WeakSpot[]
}

const BAND_BAR: Record<WeakSpot["band"], string> = {
    weak: "bg-hard",
    mixed: "bg-medium",
    strong: "bg-easy",
}

/**
 * Ranked list of topics the learner struggles with most (computeWeakSpots
 * already did the ranking — this only renders it), ending in a link to
 * drill them on /practice.
 *
 * Renders nothing when `weakSpots` is empty — a learner with fewer than
 * MIN_ATTEMPTS submissions on every topic (a brand-new learner, always) has
 * no weak spots yet, and an empty "Weak spots" card would read as a claim
 * about them that isn't true.
 */
export function WeakSpotsCard({ weakSpots }: WeakSpotsCardProps) {
    if (weakSpots.length === 0) return null

    return (
        <Card className="p-5">
            <h2 className="font-mono text-[10px] uppercase tracking-wider text-text-dim">
                Weak spots
            </h2>
            <ul className="mt-3 space-y-3">
                {weakSpots.map((spot) => (
                    <li key={spot.slug}>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">
                                {spot.name}
                            </span>
                            <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {spot.passRate}%
                            </span>
                        </div>
                        <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-panel-sunken">
                            <div
                                className={cn(
                                    "h-full rounded-full transition-[width] duration-300",
                                    BAND_BAR[spot.band]
                                )}
                                style={{ width: `${spot.passRate}%` }}
                            />
                        </div>
                    </li>
                ))}
            </ul>
            <Link
                href="/practice"
                className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
            >
                Drill these →
            </Link>
        </Card>
    )
}
