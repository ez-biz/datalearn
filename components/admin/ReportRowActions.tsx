"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { Check, Loader2, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { resolveProblemReport, reopenProblemReport } from "@/actions/reports"

export function ReportRowActions({
    id,
    resolved,
}: {
    id: string
    resolved: boolean
}) {
    const router = useRouter()
    const [pending, setPending] = useState(false)

    async function toggle() {
        setPending(true)
        try {
            if (resolved) {
                await reopenProblemReport(id)
            } else {
                await resolveProblemReport(id)
            }
            router.refresh()
        } finally {
            setPending(false)
        }
    }

    return (
        <Button
            type="button"
            variant={resolved ? "ghost" : "outline"}
            size="sm"
            onClick={toggle}
            disabled={pending}
        >
            {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : resolved ? (
                <Undo2 className="h-3.5 w-3.5" />
            ) : (
                <Check className="h-3.5 w-3.5" />
            )}
            {resolved ? "Reopen" : "Resolve"}
        </Button>
    )
}
