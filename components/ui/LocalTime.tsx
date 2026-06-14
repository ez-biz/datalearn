"use client"

import { useEffect, useState } from "react"

/**
 * Render a timestamp in the viewer's timezone. Server components render times
 * with the server's TZ via `.toLocaleString()`; this fixes that. Falls back to
 * an explicit UTC string until mounted, so the server/client first render match.
 */
export function LocalTime({ value }: { value: string }) {
    const [local, setLocal] = useState<string | null>(null)

    useEffect(() => {
        setLocal(new Date(value).toLocaleString())
    }, [value])

    return (
        <span suppressHydrationWarning>
            {local ??
                `${new Date(value).toLocaleString("en-US", {
                    timeZone: "UTC",
                })} UTC`}
        </span>
    )
}
