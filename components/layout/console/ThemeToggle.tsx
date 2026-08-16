"use client"

// Shared theme-toggle presentations, factored out of ConsoleSidebar.tsx /
// ConsoleRail.tsx so the admin sidebar/rail can render the identical control
// without duplicating it. Self-contained (own useHydratedTheme() call, no
// props) so either can be imported straight into a server component file —
// the server component never has to thread client-only state through props,
// it just renders the client leaf as a normal descendant.
import { Moon, Sun } from "lucide-react"
import { useHydratedTheme } from "@/lib/use-hydrated-theme"
import { cn } from "@/lib/utils"

const ROW =
    "flex items-center gap-2.5 rounded-[5px] px-2.5 py-[7px] text-[13.5px] transition-colors duration-150"

const CELL =
    "flex h-[34px] w-[34px] items-center justify-center rounded-md transition-colors duration-150"

/** Full-width row style, used in expanded sidebars (ConsoleSidebar,
 *  ConsoleAdminSidebar). */
export function ThemeRow() {
    const { isDark, toggle } = useHydratedTheme()

    return (
        <button
            type="button"
            onClick={toggle}
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

/** Icon-only cell style, used in collapsed rails (ConsoleRail,
 *  ConsoleAdminRailFrame). */
export function ThemeIcon() {
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
