"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { createPortal } from "react-dom"
import { ShieldCheck, X } from "lucide-react"
import { signInPath, sanitizeAuthCallbackPath } from "@/lib/auth-redirect"
import { ProviderSignInActions } from "@/components/auth/ProviderSignInActions"
import { Logo } from "@/components/ui/Logo"
import { cn } from "@/lib/utils"

interface SignInDialogButtonProps {
    children?: ReactNode
    callbackPath?: string | null
    className?: string
    panelLabel?: string
}

export function SignInDialogButton({
    children = "Sign in",
    callbackPath,
    className,
    panelLabel = "Sign in to Data Learn",
}: SignInDialogButtonProps) {
    const [open, setOpen] = useState(false)
    const [resolvedCallback, setResolvedCallback] = useState("/")
    const triggerRef = useRef<HTMLButtonElement>(null)
    const closeRef = useRef<HTMLButtonElement>(null)
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return

        const previousOverflow = document.body.style.overflow
        const trigger = triggerRef.current
        document.body.style.overflow = "hidden"
        closeRef.current?.focus()

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false)
                return
            }

            if (event.key !== "Tab") {
                return
            }

            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (!focusable?.length) return

            const first = focusable[0]
            const last = focusable[focusable.length - 1]

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault()
                last.focus()
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener("keydown", onKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            document.removeEventListener("keydown", onKeyDown)
            trigger?.focus()
        }
    }, [open])

    function openDialog() {
        const currentPath =
            callbackPath ??
            `${window.location.pathname}${window.location.search}${window.location.hash}`
        setResolvedCallback(sanitizeAuthCallbackPath(currentPath))
        setOpen(true)
    }

    const dialog =
        open
            ? createPortal(
                  <div
                      className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-6"
                      role="dialog"
                      aria-modal="true"
                      aria-label={panelLabel}
                  >
                      <button
                          type="button"
                          aria-label="Close sign-in dialog"
                          className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
                          onClick={() => setOpen(false)}
                      />
                      <div
                          ref={dialogRef}
                          data-testid="sign-in-dialog-panel"
                          className="relative w-full max-w-md rounded-lg border border-border bg-surface p-6 text-foreground shadow-xl sm:p-7"
                      >
                          <button
                              ref={closeRef}
                              type="button"
                              aria-label="Close sign-in dialog"
                              onClick={() => setOpen(false)}
                              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                          >
                              <X aria-hidden="true" className="h-4 w-4" />
                          </button>

                          <div className="pr-8">
                              <Logo />
                              <h2 className="mt-6 text-2xl font-bold tracking-tight">
                                  Train like the query is going live.
                              </h2>
                              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                  Continue with OAuth and return to your current
                                  workspace.
                              </p>
                          </div>

                          <div className="mt-6">
                              <ProviderSignInActions
                                  callbackPath={resolvedCallback}
                              />
                          </div>

                          <div className="mt-6 flex items-start gap-2 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">
                              <ShieldCheck
                                  aria-hidden="true"
                                  className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                              />
                              <p>
                                  OAuth is handled by the provider. Data Learn
                                  never asks for or stores provider passwords.
                              </p>
                          </div>

                          <Link
                              href={signInPath(resolvedCallback)}
                              className="mt-5 inline-flex text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                              Open full sign-in page
                          </Link>
                      </div>
                  </div>,
                  document.body
              )
            : null

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onClick={openDialog}
                className={cn("cursor-pointer", className)}
            >
                {children}
            </button>
            {dialog}
        </>
    )
}
