"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { TAB_BAR, isNavItemActive } from "./nav-model"

interface MobileTabBarProps {
    signedIn: boolean
    /** Rendered in place of the "You" link when signed out. */
    signInSlot: React.ReactNode
}

const CELL =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-150"

export function MobileTabBar({ signedIn, signInSlot }: MobileTabBarProps) {
    const pathname = usePathname()

    return (
        <nav
            aria-label="Primary mobile"
            className="fixed inset-x-0 bottom-0 z-50 flex h-14 border-t border-line-soft bg-panel-sunken lg:hidden"
        >
            {TAB_BAR.map((item) => {
                const Icon = item.icon

                if (item.key === "tab-you" && !signedIn) {
                    return (
                        <div key={item.key} className={cn(CELL, "text-text-dim")}>
                            {signInSlot}
                        </div>
                    )
                }

                const active = isNavItemActive(item, pathname)
                return (
                    <Link
                        key={item.key}
                        href={item.href!}
                        aria-current={active ? "page" : undefined}
                        className={cn(CELL, active ? "text-primary" : "text-text-dim")}
                    >
                        <Icon className="h-[19px] w-[19px]" aria-hidden />
                        {item.label}
                    </Link>
                )
            })}
        </nav>
    )
}
