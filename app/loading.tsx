import { Loader2 } from "lucide-react"

export default function Loading() {
    return (
        <div className="flex flex-1 min-h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm">Loading…</p>
            </div>
        </div>
    )
}
