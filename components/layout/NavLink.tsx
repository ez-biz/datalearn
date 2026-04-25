"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface NavLinkProps {
    href: string
    children: React.ReactNode
    className?: string
}

export function NavLink({ href, children, className }: NavLinkProps) {
    const pathname = usePathname()
    const isActive =
        pathname === href || (href !== "/" && pathname?.startsWith(href))

    return (
        <Link
            href={href}
            className={cn(
                "relative px-3 py-1.5 text-sm font-medium transition-colors rounded-md",
                isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-muted",
                className
            )}
        >
            {children}
            {isActive && (
                <span
                    aria-hidden
                    className="absolute left-3 right-3 -bottom-[14px] h-0.5 rounded-full bg-primary"
                />
            )}
        </Link>
    )
}
