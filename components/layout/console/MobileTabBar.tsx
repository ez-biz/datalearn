"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { TAB_BAR, isNavItemActive } from "./nav-model"

interface MobileTabBarProps {
    signedIn: boolean
    /** Rendered in the "You" cell when signed in — the account menu trigger
     *  (UserMenu with placement="tabbar"). Mobile has neither a sidebar nor
     *  a rail, so this is the only place a phone user can sign out. */
    accountSlot: React.ReactNode
    /** Rendered in the "You" cell when signed out. */
    signInSlot: React.ReactNode
}

const CELL =
    "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors duration-150"

// The "You" cell's control (UserMenu trigger or sign-in button) is a real
// interactive element nested inside this wrapper `<div>`, unlike the other
// three cells where the interactive element (the `<Link>`) carries `CELL`
// directly and its own padding is part of its clickable border-box. `py-2`
// here would instead sit *outside* the nested control, leaving a dead strip
// top and bottom that a plain `h-full` child can't reach. Dropping the
// vertical padding lets the child fill the cell edge to edge.
const ACCOUNT_CELL =
    "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150"

export function MobileTabBar({ signedIn, accountSlot, signInSlot }: MobileTabBarProps) {
    const pathname = usePathname()

    return (
        <nav
            aria-label="Primary mobile"
            className="fixed inset-x-0 bottom-0 z-50 flex h-14 border-t border-line-soft bg-panel-sunken lg:hidden"
        >
            {TAB_BAR.map((item) => {
                const Icon = item.icon

                if (item.key === "tab-you") {
                    return (
                        <div key={item.key} className={cn(ACCOUNT_CELL, "text-text-dim")}>
                            {signedIn ? accountSlot : signInSlot}
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
