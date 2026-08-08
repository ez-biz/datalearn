"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"

/**
 * Hydration-safe theme state + toggle.
 *
 * `next-themes`'s `resolvedTheme` is undefined until mount — the server
 * can't know the client's stored/system preference — so every consumer
 * needs the same "render a neutral state, then swap in the real theme
 * after mount" guard. Shared here so the theme-toggle surfaces in the
 * console shell (sidebar footer row, rail footer icon, mobile account
 * menu item, mobile signed-out menu item) don't each reimplement it.
 */
export function useHydratedTheme() {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    const isDark = mounted && resolvedTheme === "dark"
    const toggle = () => setTheme(isDark ? "light" : "dark")

    return { isDark, toggle }
}
