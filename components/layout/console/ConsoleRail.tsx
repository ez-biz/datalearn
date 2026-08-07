"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { FOOTER_NAV, PRIMARY_NAV, isNavItemActive, type NavItem } from "./nav-model"

interface ConsoleRailProps {
    onToggle: () => void
    /** Two-letter avatar fallback, e.g. "AK". Null when signed out. */
    initials: string | null
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

export function ConsoleRail({ onToggle, initials }: ConsoleRailProps) {
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
                {initials && (
                    <span className="mt-1 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-panel-hover text-[10px] font-semibold text-text-muted">
                        {initials}
                    </span>
                )}
            </div>
        </div>
    )
}
