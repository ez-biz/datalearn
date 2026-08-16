"use client"

import { cn } from "@/lib/utils"

export type Segment = "problem" | "code" | "result"

interface MobileSegmentsProps {
    active: Segment
    onChange: (segment: Segment) => void
    /** Tints the Result segment `primary` when a verdict is unseen. */
    unseenVerdict: boolean
}

const SEGMENTS: Array<{ key: Segment; label: string }> = [
    { key: "problem", label: "Problem" },
    { key: "code", label: "Code" },
    { key: "result", label: "Result" },
]

/**
 * Problem / Code / Result — the mobile workspace's view switcher.
 *
 * This only ever toggles *visibility* on panes that stay mounted the whole
 * time (see WorkspaceLayout and EditorPane, which apply `hidden` rather than
 * conditionally rendering). Monaco's model and the query result state living
 * in ProblemClient both survive every tap here.
 *
 * `role="group"` + `aria-pressed` rather than a full ARIA tablist, matching
 * the other segmented toggles in this workspace (ProblemsPanel's grouping
 * buttons, DiscussionComposer's Write/Preview) — these panes are not wired
 * up as `tabpanel`s, so a tablist role would claim more than is implemented.
 */
export function MobileSegments({
    active,
    onChange,
    unseenVerdict,
}: MobileSegmentsProps) {
    return (
        <div
            role="group"
            aria-label="Workspace view"
            className="flex h-11 flex-1 items-center gap-0.5 rounded-md border border-border bg-surface-muted/50 p-0.5"
        >
            {SEGMENTS.map((segment) => {
                const isActive = active === segment.key
                const flagVerdict = segment.key === "result" && unseenVerdict
                return (
                    <button
                        key={segment.key}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => onChange(segment.key)}
                        className={cn(
                            "relative flex h-full flex-1 items-center justify-center gap-1.5 rounded text-[13px] font-medium transition-colors duration-150",
                            isActive
                                ? "bg-surface text-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground",
                            flagVerdict && !isActive && "text-primary"
                        )}
                    >
                        {segment.label}
                        {flagVerdict && (
                            <span
                                aria-hidden
                                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                            />
                        )}
                    </button>
                )
            })}
        </div>
    )
}
