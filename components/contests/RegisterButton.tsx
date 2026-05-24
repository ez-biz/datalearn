"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2 } from "lucide-react"
import { SignInDialogButton } from "@/components/auth/SignInDialog"
import { Button } from "@/components/ui/Button"
import { registerForContest } from "@/actions/contests"

export function RegisterButton({
    contestId,
    alreadyRegistered,
    disabled,
    isSignedIn,
}: {
    contestId: string
    alreadyRegistered: boolean
    disabled: boolean
    isSignedIn: boolean
}) {
    const router = useRouter()
    const [registered, setRegistered] = useState(alreadyRegistered)
    const [error, setError] = useState<string | null>(null)
    const [pending, startTransition] = useTransition()

    if (!isSignedIn) {
        return (
            <SignInDialogButton className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover">
                Register
            </SignInDialogButton>
        )
    }

    if (registered) {
        return (
            <Button disabled variant="secondary">
                <CheckCircle2 className="h-4 w-4" />
                Registered
            </Button>
        )
    }

    return (
        <div className="space-y-2">
            <Button
                disabled={disabled || pending}
                onClick={() => {
                    setError(null)
                    startTransition(async () => {
                        try {
                            const result = await registerForContest({
                                contestId,
                            })
                            if (
                                result.status === "registered" ||
                                result.status === "already_registered"
                            ) {
                                setRegistered(true)
                                router.refresh()
                            }
                        } catch (err) {
                            setError(
                                err instanceof Error
                                    ? err.message
                                    : "Registration failed."
                            )
                        }
                    })
                }}
            >
                {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Register
            </Button>
            {error && (
                <p className="max-w-xs text-xs text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}
