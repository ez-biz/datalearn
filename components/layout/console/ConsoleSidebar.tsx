"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Moon, PanelLeft, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
    FOOTER_NAV,
    PRIMARY_NAV,
    activeNavKey,
    isNavItemActive,
    type NavItem,
} from "./nav-model"

export interface TrackProgress {
    name: string
    percent: number
}

interface ConsoleSidebarProps {
    // No `userName` prop: identity display is entirely `headerSlot`'s job.
    trackProgress: TrackProgress | null
    /** CMS pages from getNavLinks, rendered in the footer group. */
    pageLinks: Array<{ slug: string; title: string }>
    onToggle: () => void
    /** Rendered in the header slot: UserMenu when signed in, sign-in button otherwise. */
    headerSlot: React.ReactNode
}

const ROW =
    "flex items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-[13.5px] transition-colors duration-150"

function NavRow({ item, pathname, nested }: { item: NavItem; pathname: string; nested?: boolean }) {
    const active = isNavItemActive(item, pathname)
    const Icon = item.icon

    if (item.status === "soon") {
        return (
            <span
                aria-disabled="true"
                className={cn(ROW, "cursor-default text-text-dim", nested && "text-[13px]")}
            >
                <Icon className={nested ? "h-3.5 w-3.5" : "h-[15px] w-[15px]"} aria-hidden />
                {item.label}
                <span className="ml-auto font-mono text-[9px] uppercase tracking-[0.14em] text-text-dim">
                    soon
                </span>
            </span>
        )
    }

    return (
        <Link
            href={item.href!}
            aria-current={active ? "page" : undefined}
            className={cn(
                ROW,
                nested && "text-[13px]",
                active
                    ? nested
                        ? "bg-primary-row text-foreground"
                        : "bg-panel-active font-medium text-foreground shadow-sidebar-active"
                    : "text-text-muted hover:bg-panel-hover hover:text-foreground",
            )}
        >
            <Icon
                className={cn(
                    nested ? "h-3.5 w-3.5" : "h-[15px] w-[15px]",
                    active && "text-primary",
                )}
                aria-hidden
            />
            {item.label}
        </Link>
    )
}

/**
 * Sits beside Updates / Help center in the footer group. Not a NavItem (it's
 * an action, not a destination), so it renders directly rather than through
 * FOOTER_NAV + NavRow. Same hydration guard as components/ui/ThemeToggle.tsx.
 */
function ThemeRow() {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])
    const isDark = mounted && resolvedTheme === "dark"

    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className={cn(ROW, "w-full text-text-muted hover:bg-panel-hover hover:text-foreground")}
        >
            {isDark ? (
                <Moon className="h-[15px] w-[15px]" aria-hidden />
            ) : (
                <Sun className="h-[15px] w-[15px]" aria-hidden />
            )}
            {isDark ? "Dark mode" : "Light mode"}
        </button>
    )
}

export function ConsoleSidebar({
    trackProgress,
    pageLinks,
    onToggle,
    headerSlot,
}: ConsoleSidebarProps) {
    const pathname = usePathname()
    const openKey = activeNavKey(pathname)

    return (
        <div className="hidden w-[236px] shrink-0 flex-col border-r border-line-soft bg-panel lg:flex">
            <div className="flex items-center gap-2.5 px-3 pb-2.5 pt-3">
                <div className="min-w-0 flex-1">{headerSlot}</div>
                <button
                    type="button"
                    onClick={onToggle}
                    aria-label="Collapse sidebar"
                    title="Collapse sidebar"
                    className="text-text-dim transition-colors duration-150 hover:text-foreground"
                >
                    <PanelLeft className="h-[15px] w-[15px]" aria-hidden />
                </button>
            </div>

            <nav aria-label="Primary" className="flex flex-col gap-px px-2 py-1.5">
                {PRIMARY_NAV.map((item) => (
                    <div key={item.key} className="flex flex-col gap-px">
                        <NavRow item={item} pathname={pathname} />
                        {item.children && openKey === item.key && (
                            <div className="my-0.5 ml-[18px] flex flex-col gap-px border-l border-line-faint pl-2.5">
                                {item.children.map((child) => (
                                    <NavRow key={child.key} item={child} pathname={pathname} nested />
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </nav>

            <div className="mt-auto flex flex-col gap-px border-t border-line-soft p-2">
                {trackProgress && (
                    <div className="mx-2.5 mb-2.5 mt-1.5">
                        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-text-dim">
                            <span>Track</span>
                            <span className="tabular-nums text-primary">
                                {trackProgress.percent}%
                            </span>
                        </div>
                        <div className="mt-[7px] h-[3px] bg-line-faint">
                            <div
                                className="h-full bg-primary"
                                style={{ width: `${trackProgress.percent}%` }}
                            />
                        </div>
                        <div className="mt-1.5 truncate font-mono text-[11px] tabular-nums text-text-dim">
                            {trackProgress.name}
                        </div>
                    </div>
                )}

                {FOOTER_NAV.map((item) => (
                    <NavRow key={item.key} item={item} pathname={pathname} />
                ))}
                <ThemeRow />

                {pageLinks.map((page) => (
                    <Link
                        key={page.slug}
                        href={`/${page.slug}`}
                        className={cn(ROW, "text-[13px] text-text-muted hover:bg-panel-hover hover:text-foreground")}
                    >
                        <span className="min-w-0 flex-1 truncate">{page.title}</span>
                    </Link>
                ))}
            </div>
        </div>
    )
}
