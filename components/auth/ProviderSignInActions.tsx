"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Github, Loader2 } from "lucide-react"
import {
    sanitizeAuthCallbackPath,
    type AuthProvider,
} from "@/lib/auth-redirect"
import { cn } from "@/lib/utils"

interface ProviderSignInActionsProps {
    callbackPath?: string | null
}

const PROVIDERS: Array<{
    id: AuthProvider
    label: string
    marker?: string
    primary?: boolean
}> = [
    { id: "google", label: "Continue with Google", marker: "G", primary: true },
    { id: "github", label: "Continue with GitHub" },
]

export function ProviderSignInActions({
    callbackPath,
}: ProviderSignInActionsProps) {
    const [pendingProvider, setPendingProvider] = useState<AuthProvider | null>(
        null
    )
    const safeCallback = sanitizeAuthCallbackPath(callbackPath)

    async function handleProviderSignIn(provider: AuthProvider) {
        setPendingProvider(provider)
        try {
            await signIn(provider, { redirectTo: safeCallback })
        } finally {
            setPendingProvider(null)
        }
    }

    return (
        <div className="space-y-3">
            {PROVIDERS.map((provider) => (
                <ProviderButton
                    key={provider.id}
                    label={provider.label}
                    marker={provider.marker}
                    primary={provider.primary}
                    loading={pendingProvider === provider.id}
                    disabled={pendingProvider !== null}
                    onClick={() => handleProviderSignIn(provider.id)}
                />
            ))}
        </div>
    )
}

function ProviderButton({
    label,
    marker,
    primary,
    loading,
    disabled,
    onClick,
}: {
    label: string
    marker?: string
    primary?: boolean
    loading: boolean
    disabled: boolean
    onClick: () => void
}) {
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
                "inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-[background-color,border-color,box-shadow,scale,opacity] duration-150 active:scale-[0.98] disabled:cursor-wait disabled:opacity-75",
                primary
                    ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover"
                    : "border border-border bg-surface-muted text-foreground hover:border-border-strong hover:bg-surface-elevated"
            )}
        >
            {loading ? (
                <Loader2
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                />
            ) : marker ? (
                <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground"
                >
                    {marker}
                </span>
            ) : (
                <Github aria-hidden="true" className="h-4 w-4" />
            )}
            {loading ? "Redirecting..." : label}
        </button>
    )
}
