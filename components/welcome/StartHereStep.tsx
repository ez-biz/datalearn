"use client"

import { BookOpen, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/Button"
import type { EntryPoint } from "@/lib/onboarding/entry-point"

/**
 * The destination screen.
 *
 * `entry` is null whenever there is no published track, no modules, or no
 * module with a lesson — all reachable in production, because the featured
 * track ships DRAFT and `getTrackCurriculum` returns null for it to
 * non-staff. In that case this renders an honest catalog CTA rather than a
 * module card reading "0 lessons".
 *
 * The fallback links to plain /practice with no query string: the catalog
 * reads no search params (filters are client state in CatalogClient), so a
 * ?difficulty= link would be a dead parameter that looks like a feature.
 */
export function StartHereStep({
    entry,
    trackSlug,
    trackName,
    moduleCount,
    onLaunch,
    onBrowse,
    onBack,
    busy,
}: {
    entry: EntryPoint | null
    trackSlug: string | null
    trackName: string | null
    moduleCount: number
    onLaunch: (href: string) => void
    onBrowse: () => void
    onBack: () => void
    busy: boolean
}) {
    const lessonHref =
        entry && trackSlug ? `/learn/tracks/${trackSlug}/${entry.lessonSlug}` : null

    return (
        <div className="mx-auto w-full max-w-lg">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                You&rsquo;re set.
            </h1>

            {entry && lessonHref ? (
                <>
                    <p className="mt-2 text-muted-foreground">Start here.</p>
                    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <BookOpen className="h-4 w-4" aria-hidden />
                            <span className="tabular-nums">
                                Module {String(entry.modulePosition + 1).padStart(2, "0")}
                            </span>
                            <span aria-hidden>·</span>
                            <span>{entry.moduleName}</span>
                        </div>
                        <p className="mt-3 text-base font-medium">{entry.lessonTitle}</p>
                        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                            {entry.lessonCount} lesson{entry.lessonCount === 1 ? "" : "s"} in this module
                            {entry.readingMinutes !== null
                                ? ` · ~${entry.readingMinutes} min to read`
                                : ""}
                        </p>
                    </div>
                    {trackName ? (
                        <p className="mt-3 text-sm text-muted-foreground tabular-nums">
                            {trackName} · {moduleCount} modules
                        </p>
                    ) : null}
                    <div className="mt-8 flex items-center justify-between gap-4">
                        <Button variant="ghost" onClick={onBack} disabled={busy}>
                            Back
                        </Button>
                        <Button onClick={() => onLaunch(lessonHref)} disabled={busy}>
                            Start lesson
                        </Button>
                    </div>
                    <button
                        type="button"
                        onClick={onBrowse}
                        disabled={busy}
                        className="mt-4 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    >
                        Or browse all problems instead
                    </button>
                </>
            ) : (
                <>
                    <p className="mt-2 text-muted-foreground">
                        There&rsquo;s no published lesson path yet, so start with the
                        problem catalog — everything runs in your browser.
                    </p>
                    <div className="mt-6 rounded-lg border border-border bg-surface p-5">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <ListChecks className="h-4 w-4" aria-hidden />
                            <span>Practice catalog</span>
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                            Filter by difficulty and topic once you&rsquo;re in.
                        </p>
                    </div>
                    <div className="mt-8 flex items-center justify-between gap-4">
                        <Button variant="ghost" onClick={onBack} disabled={busy}>
                            Back
                        </Button>
                        <Button onClick={onBrowse} disabled={busy}>
                            Browse problems
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
