"use client"

import { useCallback, useState } from "react"
import { Check, Link2 } from "lucide-react"

/**
 * Copy a contest's share URL to the clipboard, briefly flashing "Copied!".
 * Used on the custom-contest detail page next to the share link.
 */
export function CopyLinkButton({ url }: { url: string }) {
    const [copied, setCopied] = useState(false)

    const copy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(url)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        } catch {
            // Clipboard access can fail (insecure context / denied permission);
            // silently no-op rather than throwing in the UI.
        }
    }, [url])

    return (
        <button
            type="button"
            onClick={copy}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
        >
            {copied ? (
                <Check className="h-3.5 w-3.5 text-easy-fg" />
            ) : (
                <Link2 className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied!" : "Copy link"}
        </button>
    )
}
