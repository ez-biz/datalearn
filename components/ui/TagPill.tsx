import Link from "next/link"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface TagPillProps {
    slug: string
    name: string
    kind?: "TOPIC" | "COMPANY"
    size?: "sm" | "md"
    className?: string
    /**
     * When the pill is rendered inside a clickable parent (a problem row
     * that links to /practice/<slug>), set this to true so clicks on the
     * pill don't bubble up and navigate the user away from the tag page.
     */
    stopPropagation?: boolean
}

const sizes = {
    sm: "px-2 py-0.5 text-[10px]",
    md: "px-2.5 py-1 text-xs",
}

export function TagPill({
    slug,
    name,
    kind = "TOPIC",
    size = "sm",
    className,
    stopPropagation = false,
}: TagPillProps) {
    const isCompany = kind === "COMPANY"
    return (
        <Link
            href={`/practice/tags/${slug}`}
            onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
            className={cn(
                "inline-flex items-center rounded-full border border-border bg-surface-muted/60 font-mono font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground hover:border-border-strong",
                !isCompany && "lowercase",
                isCompany &&
                    "border-primary/20 bg-primary/5 text-foreground hover:border-primary/30 hover:bg-primary/10 hover:text-foreground",
                sizes[size],
                className,
            )}
        >
            {isCompany && <Building2 className="mr-1 h-3 w-3" />}
            {name}
        </Link>
    )
}
