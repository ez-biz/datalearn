"use client"

import { useEffect, useState } from "react"
import { Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

interface MobileNavProps {
    items: { href: string; label: string }[]
    extra?: React.ReactNode
}

export function MobileNav({ items, extra }: MobileNavProps) {
    const [open, setOpen] = useState(false)
    const pathname = usePathname()

    useEffect(() => {
        setOpen(false)
    }, [pathname])

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : ""
        return () => {
            document.body.style.overflow = ""
        }
    }, [open])

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                aria-expanded={open}
                onClick={() => setOpen(true)}
                className="md:hidden"
            >
                <Menu className="h-5 w-5" />
            </Button>

            {open && (
                <div className="fixed inset-0 z-[60] md:hidden">
                    <div
                        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                        onClick={() => setOpen(false)}
                        aria-hidden
                    />
                    <div className="absolute right-0 top-0 h-full w-72 max-w-[85vw] bg-surface border-l border-border shadow-xl flex flex-col">
                        <div className="flex items-center justify-between h-16 px-4 border-b border-border">
                            <span className="text-sm font-semibold">Navigation</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setOpen(false)}
                                aria-label="Close navigation"
                            >
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                        <nav className="flex-1 overflow-y-auto p-4">
                            <ul className="space-y-1">
                                {items.map((item) => {
                                    const isActive =
                                        pathname === item.href ||
                                        (item.href !== "/" && pathname?.startsWith(item.href))
                                    return (
                                        <li key={item.href}>
                                            <Link
                                                href={item.href}
                                                className={cn(
                                                    "block rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                                    isActive
                                                        ? "bg-primary/10 text-primary"
                                                        : "text-foreground hover:bg-surface-muted"
                                                )}
                                            >
                                                {item.label}
                                            </Link>
                                        </li>
                                    )
                                })}
                            </ul>
                            {extra && (
                                <div className="mt-6 pt-6 border-t border-border">{extra}</div>
                            )}
                        </nav>
                    </div>
                </div>
            )}
        </>
    )
}
