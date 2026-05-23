import { cn } from "@/lib/utils"

interface KbdProps {
    children: React.ReactNode
    tone?: "default" | "on-primary"
    className?: string
}

export function Kbd({ children, tone = "default", className }: KbdProps) {
    return (
        <kbd
            className={cn(
                "inline-flex items-center justify-center font-mono",
                "border rounded px-1.5 py-0.5 text-[11px] min-w-[18px]",
                "shadow-[inset_0_-1px_0_hsl(var(--border))]",
                tone === "default"
                    ? "border-border bg-surface-muted text-foreground"
                    : "border-primary-foreground/30 bg-primary-foreground/20 text-primary-foreground",
                className
            )}
        >
            {children}
        </kbd>
    )
}
