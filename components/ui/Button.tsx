import { forwardRef } from "react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type Variant = "primary" | "secondary" | "ghost" | "outline" | "destructive" | "accent"
type Size = "sm" | "md" | "lg" | "icon"

const base =
    "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,box-shadow,scale,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.96] cursor-pointer"

const variants: Record<Variant, string> = {
    primary:
        "bg-primary text-primary-foreground hover:bg-primary-hover shadow-sm",
    secondary:
        "bg-surface-muted text-foreground hover:bg-surface-elevated border border-border",
    ghost: "text-foreground hover:bg-surface-muted",
    outline:
        "border border-border bg-surface text-foreground hover:bg-surface-muted hover:border-border-strong",
    destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm",
}

const sizes: Record<Size, string> = {
    sm: "h-8 px-3 text-xs rounded-md",
    md: "h-10 px-4 text-sm rounded-md",
    lg: "h-11 px-6 text-sm rounded-lg",
    icon: "h-9 w-9 rounded-md",
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant
    size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = "primary", size = "md", ...props }, ref) => (
        <button
            ref={ref}
            className={cn(base, variants[variant], sizes[size], className)}
            {...props}
        />
    )
)
Button.displayName = "Button"

interface LinkButtonProps {
    href: string
    variant?: Variant
    size?: Size
    className?: string
    children: ReactNode
    target?: string
    rel?: string
}

export function LinkButton({
    href,
    variant = "primary",
    size = "md",
    className,
    children,
    target,
    rel,
}: LinkButtonProps) {
    const isExternal = href.startsWith("http") || target === "_blank"
    if (isExternal) {
        return (
            <a
                href={href}
                target={target ?? "_blank"}
                rel={rel ?? "noopener noreferrer"}
                className={cn(base, variants[variant], sizes[size], className)}
            >
                {children}
            </a>
        )
    }
    return (
        <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
            {children}
        </Link>
    )
}
