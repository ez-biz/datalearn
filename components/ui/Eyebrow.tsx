import { cn } from "@/lib/utils"

type EyebrowVariant = "plain" | "bracket"

interface EyebrowProps {
    children: React.ReactNode
    variant?: EyebrowVariant
    className?: string
}

export function Eyebrow({ children, variant = "plain", className }: EyebrowProps) {
    return (
        <div
            className={cn(
                "text-[11px] font-mono uppercase tracking-widest",
                variant === "bracket" ? "bracket" : "text-muted-foreground",
                className
            )}
        >
            {children}
        </div>
    )
}
