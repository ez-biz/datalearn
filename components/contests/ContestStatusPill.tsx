import { Badge } from "@/components/ui/Badge"

export function ContestStatusPill({
    status,
}: {
    status: "SCHEDULED" | "LIVE" | "CLOSED" | "FINALIZED" | "CANCELLED"
}) {
    const label =
        status === "SCHEDULED"
            ? "Upcoming"
            : status === "LIVE"
              ? "Live"
              : status === "FINALIZED"
                ? "Finalized"
                : status === "CANCELLED"
                  ? "Cancelled"
                  : "Closed"
    const variant =
        status === "LIVE"
            ? "easy"
            : status === "SCHEDULED"
              ? "primary"
              : status === "CANCELLED"
                ? "hard"
                : "secondary"

    return <Badge variant={variant}>{label}</Badge>
}
