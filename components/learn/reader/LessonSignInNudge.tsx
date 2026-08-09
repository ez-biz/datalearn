import { Lock } from "lucide-react"
import { LinkButton } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface LessonSignInNudgeProps {
    className?: string
    /**
     * `sm` (32px) is fine in the desktop aside rail; the mobile copy at the
     * end of `<main>` passes `lg` (44px) to clear the touch-target minimum.
     */
    size?: "sm" | "lg"
}

/**
 * The signed-out nudge, rendered in two places and therefore living in
 * neither: `LessonAsideRail` (visible `lg` and up) and the end of `<main>`
 * on the reader page (visible below `lg`, where the rail is hidden and the
 * focus route suppresses `MobileTabBar` and its sign-in slot). One copy of
 * the sentence so the two cannot drift apart.
 *
 * Deliberately NOT a client component — no hooks, no state — so the server
 * page can render it without a boundary while the client rail imports the
 * same module.
 */
export function LessonSignInNudge({ className, size = "sm" }: LessonSignInNudgeProps) {
    return (
        <section
            className={cn(
                "rounded-lg border border-dashed border-line-strong p-3",
                className,
            )}
        >
            <h2 className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                <Lock aria-hidden="true" className="size-3.5" />
                Not signed in
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                Reading is free. Sign in to keep the checkmarks and the streak.
            </p>
            <LinkButton href="/auth/signin" className="mt-3 w-full" size={size}>
                Sign in
            </LinkButton>
        </section>
    )
}
