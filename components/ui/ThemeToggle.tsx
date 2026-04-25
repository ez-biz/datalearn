"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Button } from "./Button"

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    const isDark = mounted && resolvedTheme === "dark"

    return (
        <Button
            variant="ghost"
            size="icon"
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="relative"
        >
            <Sun
                className={`h-4 w-4 transition-all ${isDark ? "scale-0 -rotate-90" : "scale-100 rotate-0"}`}
            />
            <Moon
                className={`absolute h-4 w-4 transition-all ${isDark ? "scale-100 rotate-0" : "scale-0 rotate-90"}`}
            />
        </Button>
    )
}
