import { cn } from "@/lib/utils"
import type { ProfileData } from "@/actions/profile"

const BUCKETS: Array<{
    key: ProfileData["skills"][number]["bucket"]
    label: string
    dot: string
}> = [
    { key: "advanced", label: "Advanced", dot: "bg-hard" },
    { key: "intermediate", label: "Intermediate", dot: "bg-medium" },
    { key: "fundamental", label: "Fundamental", dot: "bg-easy" },
]

/**
 * LeetCode-style three-bucket skill display. Buckets are computed
 * server-side from the user's own distribution (top tertile = Advanced,
 * etc.) so the labels stay meaningful even for new users.
 */
export function SkillsByTag({
    skills,
}: {
    skills: ProfileData["skills"]
}) {
    if (skills.length === 0) {
        return (
            <div className="text-sm text-muted-foreground">
                Solve a problem with tags to start building this view.
            </div>
        )
    }
    return (
        <div className="space-y-4">
            {BUCKETS.map((bucket) => {
                const items = skills.filter((s) => s.bucket === bucket.key)
                if (items.length === 0) return null
                return (
                    <div key={bucket.key}>
                        <div className="flex items-center gap-2 mb-2">
                            <span
                                aria-hidden
                                className={cn(
                                    "h-2 w-2 rounded-full",
                                    bucket.dot
                                )}
                            />
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {bucket.label}
                            </h3>
                        </div>
                        <ul className="flex flex-wrap gap-1.5">
                            {items.map((s) => (
                                <li key={s.slug}>
                                    <span
                                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-muted px-2 py-1 text-xs"
                                        title={`${s.solvedCount} solved`}
                                    >
                                        <span className="font-medium text-foreground">
                                            {s.name}
                                        </span>
                                        <span className="tabular-nums text-muted-foreground">
                                            ×{s.solvedCount}
                                        </span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            })}
        </div>
    )
}
