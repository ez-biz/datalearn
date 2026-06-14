"use client"

import { useEffect, useState } from "react"
import { formatRemaining } from "@/lib/contests/play"

type Props = {
    /** ISO timestamp of the contest end. */
    endsAt: string
    /** Called once when the countdown reaches zero. */
    onExpire?: () => void
}

export function ContestCountdown({ endsAt, onExpire }: Props) {
    const end = new Date(endsAt).getTime()
    // `null` until mounted so server and first client render match (no hydration
    // mismatch); the interval then drives the tick.
    const [now, setNow] = useState<number | null>(null)

    useEffect(() => {
        setNow(Date.now())
        const id = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(id)
    }, [])

    const expired = now !== null && end - now <= 0

    useEffect(() => {
        if (expired) onExpire?.()
    }, [expired, onExpire])

    if (now === null) {
        return <span className="tabular-nums text-muted-foreground">—</span>
    }
    if (expired) {
        return <span className="text-muted-foreground">Contest ended</span>
    }
    return (
        <span className="tabular-nums text-muted-foreground">
            {formatRemaining(end - now)} left
        </span>
    )
}
