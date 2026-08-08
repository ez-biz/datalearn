"use client"

import { useEffect, useRef, useState } from "react"
import { LogIn, Moon, Sun, User } from "lucide-react"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { useHydratedTheme } from "@/lib/use-hydrated-theme"
import { cn } from "@/lib/utils"

/**
 * The mobile tab bar's "You" cell when signed out.
 *
 * Below `lg` there is no sidebar or rail, and the account menu (which also
 * carries the mobile theme toggle — see UserMenu's placement="tabbar") is
 * signed-in only. Without this, an anonymous phone visitor has no way to
 * reach light/dark mode at all. Opening a small popover here — instead of
 * jumping straight to the sign-in dialog — mirrors the signed-in "You" cell
 * (which also opens a popover) and gives signed-out users the same surface,
 * rather than adding a fifth tab or relying on the footer (which sits below
 * all page content and would require scrolling past a full problem list on
 * every route to reach).
 */
export function MobileSignInMenu() {
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const { isDark, toggle } = useHydratedTheme()

    useEffect(() => {
        if (!open) return
        function onPointerDown(e: PointerEvent) {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false)
            }
        }
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setOpen(false)
                triggerRef.current?.focus()
            }
        }
        document.addEventListener("pointerdown", onPointerDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("pointerdown", onPointerDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [open])

    return (
        <div className="relative flex h-full w-full" ref={containerRef}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={open ? "Close menu" : "Open menu"}
                title={open ? "Close menu" : "Open menu"}
                onClick={() => setOpen((v) => !v)}
                className="flex h-full w-full flex-col items-center justify-center gap-1 text-[11px] font-medium text-text-dim"
            >
                <User className="h-[19px] w-[19px]" aria-hidden />
                Sign in
            </button>

            {open && (
                <div
                    role="menu"
                    aria-label="Menu"
                    className="absolute bottom-[calc(100%+8px)] right-0 z-50 w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
                >
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                            toggle()
                            setOpen(false)
                        }}
                        className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
                    >
                        {isDark ? (
                            <Sun className="h-4 w-4" aria-hidden="true" />
                        ) : (
                            <Moon className="h-4 w-4" aria-hidden="true" />
                        )}
                        {isDark ? "Switch to light theme" : "Switch to dark theme"}
                    </button>
                    <div className="border-t border-border">
                        <SignInDialogButton
                            role="menuitem"
                            panelLabel="Sign in from navigation"
                            className={cn(
                                "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-surface-hover"
                            )}
                        >
                            <LogIn className="h-4 w-4" aria-hidden="true" />
                            Sign in
                        </SignInDialogButton>
                    </div>
                </div>
            )}
        </div>
    )
}
