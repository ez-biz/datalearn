import { BookOpen, CheckCircle2, LockKeyhole, Unlock } from "lucide-react"
import { Card } from "@/components/ui/Card"

const RULES = [
    {
        icon: LockKeyhole,
        text: "A module unlocks once the module before it reaches 100%.",
    },
    {
        icon: BookOpen,
        text: "Lessons auto-complete as soon as you finish reading them.",
    },
    {
        icon: CheckCircle2,
        text: "Problems complete the moment a submission is accepted.",
    },
    {
        // The user-facing statement of the advisory-unlock rule
        // (lib/curriculum-progress.ts's isModuleUnlocked / CLAUDE.md's
        // "never enforce module unlocking"): locked is a hint, never a
        // gate, and every lesson/problem link keeps working regardless.
        icon: Unlock,
        text: "Skipping ahead is always allowed — nothing is ever really locked.",
    },
] as const

/**
 * Static rail copy for the track detail page's module branch, replacing
 * the item-based "Track rhythm" card the `TrackItem` fallback still uses.
 */
export function RulesOfThePath() {
    return (
        <Card className="p-5">
            <h2 className="font-semibold tracking-tight">Rules of the path</h2>
            <ul className="mt-3 space-y-3">
                {RULES.map(({ icon: Icon, text }) => (
                    <li
                        key={text}
                        className="flex items-start gap-2.5 text-sm leading-6 text-muted-foreground"
                    >
                        <Icon
                            className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                            aria-hidden="true"
                        />
                        <span>{text}</span>
                    </li>
                ))}
            </ul>
        </Card>
    )
}
