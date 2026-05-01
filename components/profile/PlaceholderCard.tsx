import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"

interface PlaceholderCardProps {
    icon: ReactNode
    title: string
    description: string
    /** Optional pill text — e.g. "Coming soon", "v2", a feature flag. */
    statusLabel?: string
}

/**
 * Sized placeholder card for sections we want to surface in the profile
 * layout now (Contests, Languages, Education, Resume, Work, Links) but
 * don't have schema for yet. Renders the title + a one-liner explaining
 * what will appear there, plus a "Coming soon" pill so users don't think
 * something's broken.
 */
export function PlaceholderCard({
    icon,
    title,
    description,
    statusLabel = "Coming soon",
}: PlaceholderCardProps) {
    return (
        <Card>
            <CardContent className="p-6">
                <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2.5">
                        <span className="text-muted-foreground">{icon}</span>
                        <h2 className="text-base font-semibold tracking-tight">
                            {title}
                        </h2>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                        {statusLabel}
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{description}</p>
            </CardContent>
        </Card>
    )
}
