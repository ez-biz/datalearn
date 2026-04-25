import { ArrowRight, Compass } from "lucide-react"
import { LinkButton } from "@/components/ui/Button"

export default function NotFound() {
    return (
        <main className="flex flex-1 min-h-[70vh] flex-col items-center justify-center text-center px-4 py-16">
            <div className="text-7xl sm:text-8xl font-bold tracking-tighter text-primary/15">
                404
            </div>
            <div className="-mt-4 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                <Compass className="h-5 w-5" />
            </div>
            <h1 className="mt-6 text-2xl font-semibold tracking-tight">
                Page not found
            </h1>
            <p className="mt-2 text-muted-foreground max-w-md">
                That page doesn&apos;t exist. Try one of these instead.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <LinkButton href="/practice">
                    Browse problems
                    <ArrowRight className="h-4 w-4" />
                </LinkButton>
                <LinkButton href="/" variant="outline">
                    Back to home
                </LinkButton>
            </div>
        </main>
    )
}
