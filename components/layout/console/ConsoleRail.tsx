"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Moon, PanelLeft, Sun } from "lucide-react"
import { useHydratedTheme } from "@/lib/use-hydrated-theme"
import { cn } from "@/lib/utils"
import { FOOTER_NAV, PRIMARY_NAV, isNavItemActive, type NavItem } from "./nav-model"

interface ConsoleRailProps {
    onToggle: () => void
    /**
     * Account menu trigger (UserMenu with placement="rail"), rendered as the
     * last footer icon. Null when signed out — the rail shows no separate
     * "you" affordance for anonymous visitors, matching the previous
     * behavior; sign-in lives in the expanded sidebar header.
     */
    accountSlot: React.ReactNode | null
}

const CELL =
    "flex h-[34px] w-[34px] items-center justify-center rounded-md transition-colors duration-150"

function RailItem({ item, pathname }: { item: NavItem; pathname: string }) {
    const Icon = item.icon

    if (item.status === "soon") {
        return (
            <span
                aria-disabled="true"
                title={`${item.label} — coming soon`}
                className={cn(CELL, "cursor-default text-icon-off")}
            >
                <Icon className="h-[17px] w-[17px]" aria-hidden />
            </span>
        )
    }

    const active = isNavItemActive(item, pathname)
    return (
        <Link
            href={item.href!}
            aria-label={item.label}
            title={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
                CELL,
                active
                    ? "bg-panel-active text-primary shadow-sidebar-active"
                    : "text-text-dim hover:bg-panel-hover hover:text-foreground",
            )}
        >
            <Icon className="h-[17px] w-[17px]" aria-hidden />
        </Link>
    )
}

/** Same visual footprint as RailItem's interactive state, but for an action
 *  rather than a NavItem. */
function ThemeIcon() {
    const { isDark, toggle } = useHydratedTheme()

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className={cn(CELL, "text-text-dim hover:bg-panel-hover hover:text-foreground")}
        >
            {isDark ? (
                <Moon className="h-[17px] w-[17px]" aria-hidden />
            ) : (
                <Sun className="h-[17px] w-[17px]" aria-hidden />
            )}
        </button>
    )
}

export function ConsoleRail({ onToggle, accountSlot }: ConsoleRailProps) {
    const pathname = usePathname()

    return (
        <div className="hidden w-14 shrink-0 flex-col items-center gap-0.5 border-r border-line-soft bg-panel py-3 lg:flex">
            <button
                type="button"
                onClick={onToggle}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-dim transition-colors duration-150 hover:text-foreground"
            >
                <PanelLeft className="h-4 w-4" aria-hidden />
            </button>

            <span className="my-1.5 h-px w-6 bg-line-faint" />

            <nav aria-label="Primary" className="flex flex-col items-center gap-0.5">
                {PRIMARY_NAV.map((item) => (
                    <RailItem key={item.key} item={item} pathname={pathname} />
                ))}
            </nav>

            <div className="mt-auto flex flex-col items-center gap-0.5">
                {FOOTER_NAV.map((item) => (
                    <RailItem key={item.key} item={item} pathname={pathname} />
                ))}
                <ThemeIcon />
                {accountSlot && <div className="mt-1">{accountSlot}</div>}
            </div>
        </div>
    )
}
