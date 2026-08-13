import type { PublicTrack } from "@/actions/tracks"
import { Badge } from "@/components/ui/Badge"

/**
 * `TrackCard` and its private `TrackCover` helper (the old grid-card
 * rendering for the tracks index) were deleted in SP4 Task 10 — SP4 Task 9
 * replaced the index with `TrackSummaryCard`
 * (components/learn/tracks/TrackSummaryCard.tsx), and a repo-wide grep
 * turned up no other importer. `TrackDifficultyBadge` survives: the track
 * detail page (app/learn/tracks/[slug]/page.tsx) still uses it for the
 * difficulty chip in both the module and TrackItem-fallback branches.
 */
export function TrackDifficultyBadge({
    difficulty,
}: {
    difficulty: PublicTrack["difficulty"]
}) {
    if (difficulty === "EASY") {
        return <Badge variant="easy">Easy</Badge>
    }
    if (difficulty === "MEDIUM") {
        return <Badge variant="medium">Medium</Badge>
    }
    if (difficulty === "HARD") {
        return <Badge variant="hard">Hard</Badge>
    }
    return <Badge variant="primary">Mixed</Badge>
}
