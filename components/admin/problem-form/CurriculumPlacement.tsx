"use client"

import { useEffect, useMemo, useState } from "react"
import { BookOpen, Info } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"
import { EmptyState } from "@/components/ui/EmptyState"
import { LinkButton } from "@/components/ui/Button"
import { cn } from "@/lib/utils"

export interface CurriculumBinding {
    lessonId: string
    lessonSlug: string
    lessonTitle: string
    trackName: string | null
    moduleName: string | null
    position: number
}

interface LessonOption {
    id: string
    slug: string
    title: string
    trackName: string | null
    moduleName: string | null
    checkpointCount: number
}

interface CurriculumPlacementProps {
    /** Curriculum placement only works once the problem exists — see the
     * "create" branch below. */
    mode: "create" | "edit"
    /** The selected lesson's article id, or "" for no lesson. Lifted to
     * ProblemForm so it survives tab switches and feeds the main submit
     * payload's `curriculumLessonId`, same as every other form field. */
    value: string
    onChange: (next: string) => void
    /** What's on record right now (before any unsaved change), for the
     * "currently" readout. `null` when this problem has no checkpoint. */
    initialBinding: CurriculumBinding | null
    error?: string
}

const NONE_VALUE = ""

/**
 * The Curriculum tab's binding panel (Task 11, SP7).
 *
 * THREE RULES, all load-bearing — see the task brief:
 *
 * 1. Backed entirely by the existing `LessonCheckpoint` relation
 *    (`articleId` + `problemId` + `position`). No new columns anywhere —
 *    this component only ever sends an article id up to `ProblemForm`,
 *    which folds it into the same PATCH payload every other field uses.
 * 2. The actual write happens server-side in
 *    `app/api/admin/problems/[slug]/route.ts`'s PATCH handler, which calls
 *    ONLY `addCheckpoint`/`removeCheckpoint` from `lib/admin-curriculum.ts`
 *    — never a direct `position` write.
 * 3. `LessonCheckpoint` has `@@unique([problemId])`: a problem checks at
 *    most one lesson. Picking a different lesson here REASSIGNS the
 *    binding, it does not add a second one. The copy below says so
 *    explicitly, in both the populated and empty states.
 */
export function CurriculumPlacement({
    mode,
    value,
    onChange,
    initialBinding,
    error,
}: CurriculumPlacementProps) {
    const [lessons, setLessons] = useState<LessonOption[]>([])
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)

    useEffect(() => {
        if (mode !== "edit") {
            setLoading(false)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const res = await fetch("/api/admin/lessons")
                if (!res.ok) {
                    if (!cancelled) setLoadError("Could not load lessons.")
                    return
                }
                const json = await res.json()
                if (!cancelled) setLessons(json.data ?? [])
            } catch {
                if (!cancelled) setLoadError("Could not load lessons.")
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [mode])

    // Group by track > module for the <optgroup> layout, in the order the
    // API returned them (already title-sorted).
    const groups = useMemo(() => {
        const map = new Map<string, LessonOption[]>()
        for (const lesson of lessons) {
            const key =
                lesson.trackName && lesson.moduleName
                    ? `${lesson.trackName} › ${lesson.moduleName}`
                    : "Ungrouped"
            const bucket = map.get(key)
            if (bucket) bucket.push(lesson)
            else map.set(key, [lesson])
        }
        // /api/admin/lessons only lists lessons placed in a module
        // (moduleLessons: { some: {} }), but addCheckpoint's findArticleId
        // has no such requirement — a problem can stay bound to a lesson
        // that was later pulled out of its module. Without this, the
        // <select>'s value matches no <option>, so the browser silently
        // falls back to "— No lesson (remove binding) —" while the readout
        // below still says "Currently the checkpoint for X": bound and
        // unbound on the same panel. Surface it instead of dropping it, in
        // its own labeled group, rather than changing what addCheckpoint
        // accepts.
        if (initialBinding && !lessons.some((l) => l.id === initialBinding.lessonId)) {
            map.set("No longer in a module", [
                {
                    id: initialBinding.lessonId,
                    slug: initialBinding.lessonSlug,
                    title: initialBinding.lessonTitle,
                    trackName: null,
                    moduleName: null,
                    checkpointCount: 0,
                },
            ])
        }
        return Array.from(map.entries())
    }, [lessons, initialBinding])

    const selectedLesson = lessons.find((l) => l.id === value)
    const willReassign =
        value !== NONE_VALUE &&
        initialBinding !== null &&
        value !== initialBinding.lessonId
    const willUnbind = value === NONE_VALUE && initialBinding !== null

    if (mode === "create") {
        return (
            <PanelShell>
                <EmptyState
                    icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                    title="Save the problem first"
                    description="Curriculum placement binds an existing problem to a lesson checkpoint. Create this problem on the Basics tab, then come back here to bind it."
                />
            </PanelShell>
        )
    }

    return (
        <PanelShell>
            <p className="text-sm text-muted-foreground">
                A problem can check at most one lesson — `LessonCheckpoint` enforces
                this at the database level. Picking a different lesson below{" "}
                <span className="font-medium text-foreground">reassigns</span> this
                problem&apos;s checkpoint; it never adds a second binding.
            </p>

            {loading ? (
                <p className="text-sm text-muted-foreground">Loading lessons…</p>
            ) : loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
            ) : lessons.length === 0 ? (
                <EmptyState
                    icon={<BookOpen className="h-5 w-5" aria-hidden="true" />}
                    title="No lessons exist yet"
                    description="A lesson is an Article placed inside a Module. Create the content at Articles, then place it in a track's module — see docs/API.md for the curriculum endpoints. Once at least one lesson exists, it appears here to bind as this problem's checkpoint."
                    action={
                        <LinkButton href="/admin/articles/new" variant="outline" size="sm">
                            Create a lesson article
                        </LinkButton>
                    }
                />
            ) : (
                <div className="space-y-2">
                    <label
                        htmlFor="curriculumLessonId"
                        className="block text-sm font-medium text-foreground"
                    >
                        Checkpoint lesson
                    </label>
                    <select
                        id="curriculumLessonId"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className="block w-full h-10 px-3 text-sm rounded-md border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <option value={NONE_VALUE}>— No lesson (remove binding) —</option>
                        {groups.map(([groupLabel, groupLessons]) => (
                            <optgroup key={groupLabel} label={groupLabel}>
                                {groupLessons.map((lesson) => (
                                    <option key={lesson.id} value={lesson.id}>
                                        {lesson.title}
                                        {lesson.checkpointCount > 0
                                            ? ` (${lesson.checkpointCount} checkpoint${lesson.checkpointCount === 1 ? "" : "s"} already)`
                                            : ""}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                    {error && <p className="text-xs text-destructive">{error}</p>}

                    <div
                        className={cn(
                            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs",
                            willReassign || willUnbind
                                ? "border-warning/30 bg-warning/10 text-warning"
                                : "border-border bg-surface-muted/40 text-muted-foreground"
                        )}
                    >
                        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                        {initialBinding && !willUnbind && !willReassign && (
                            <span>
                                Currently the checkpoint for{" "}
                                <span className="font-medium text-foreground">
                                    {initialBinding.lessonTitle}
                                </span>
                                {initialBinding.trackName && (
                                    <>
                                        {" "}
                                        ({initialBinding.trackName}
                                        {initialBinding.moduleName
                                            ? ` › ${initialBinding.moduleName}`
                                            : ""}
                                        )
                                    </>
                                )}
                                , position #{initialBinding.position + 1}.
                            </span>
                        )}
                        {!initialBinding && !willReassign && (
                            <span>Not bound to any lesson yet.</span>
                        )}
                        {willReassign && selectedLesson && (
                            <span>
                                Will reassign this problem from{" "}
                                <span className="font-medium text-foreground">
                                    {initialBinding?.lessonTitle}
                                </span>{" "}
                                to{" "}
                                <span className="font-medium text-foreground">
                                    {selectedLesson.title}
                                </span>{" "}
                                on save — the old binding is removed, not kept alongside
                                the new one.
                            </span>
                        )}
                        {willUnbind && (
                            <span>
                                Will remove this problem as the checkpoint for{" "}
                                <span className="font-medium text-foreground">
                                    {initialBinding?.lessonTitle}
                                </span>{" "}
                                on save.
                            </span>
                        )}
                    </div>
                </div>
            )}
        </PanelShell>
    )
}

/**
 * The violet-tinted card frame shared by every state (loading, empty,
 * populated) — "the admin violet is text-accent / bg-accent/15" per the
 * project's binding color-token rules.
 */
function PanelShell({ children }: { children: React.ReactNode }) {
    return (
        <Card className="border-accent/25 bg-accent/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
                        <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        Curriculum
                    </span>
                    Checkpoint placement
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    )
}
