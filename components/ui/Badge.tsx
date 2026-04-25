import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

type Variant = "default" | "secondary" | "outline" | "easy" | "medium" | "hard" | "primary" | "accent"

const variants: Record<Variant, string> = {
    default: "bg-muted text-foreground",
    secondary: "bg-surface-muted text-muted-foreground border border-border",
    outline: "border border-border text-muted-foreground",
    primary: "bg-primary/10 text-primary border border-primary/20",
    accent: "bg-accent/10 text-accent border border-accent/20",
    easy: "bg-easy-bg text-easy-fg",
    medium: "bg-medium-bg text-medium-fg",
    hard: "bg-hard-bg text-hard-fg",
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    variant?: Variant
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
                variants[variant],
                className
            )}
            {...props}
        />
    )
}

export function DifficultyBadge({ difficulty, className }: { difficulty: string; className?: string }) {
    const normalized = difficulty?.toLowerCase()
    const variant: Variant =
        normalized === "easy" ? "easy" : normalized === "medium" ? "medium" : "hard"
    const label =
        normalized === "easy" ? "Easy" : normalized === "medium" ? "Medium" : "Hard"
    return (
        <Badge variant={variant} className={cn("normal-case tracking-normal", className)}>
            {label}
        </Badge>
    )
}
