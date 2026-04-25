"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { LinkButton } from "@/components/ui/Button"

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error("Application error:", error)
    }, [error])

    return (
        <main className="flex flex-1 min-h-[70vh] flex-col items-center justify-center text-center px-4 py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-5">
                <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Something broke</h1>
            <p className="mt-2 text-muted-foreground max-w-md">
                An unexpected error occurred. You can retry, or head back to the
                homepage.
            </p>
            {error.digest && (
                <p className="mt-3 text-xs font-mono text-muted-foreground">
                    Reference: {error.digest}
                </p>
            )}
            <div className="mt-8 flex gap-3">
                <Button onClick={reset}>
                    <RotateCw className="h-4 w-4" />
                    Try again
                </Button>
                <LinkButton href="/" variant="outline">
                    Back to home
                </LinkButton>
            </div>
        </main>
    )
}
