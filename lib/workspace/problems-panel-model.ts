// Pure grouping/filtering model for the workspace problems panel. No React,
// no Prisma, no DOM — so it unit-tests without a database, the same way
// components/learn/reader/lesson-nav.ts does for the reader.
//
// Everything that decides what the panel's rows look like lives here;
// ProblemsPanel only renders the result.

export type PanelProblem = {
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    solved: boolean
    /** Curriculum module this problem sits in, or null when it is catalog-only. */
    moduleId: string | null
    modulePosition: number | null
    moduleTitle: string | null
    tags: string[]
}

export type PanelGroup = {
    /** moduleId, tag slug, or UNGROUPED. */
    key: string
    /** "04 · Window functions" | "joins" | "Not in a track" */
    label: string
    done: number
    total: number
    problems: PanelProblem[]
}

export type PanelMode = "track" | "todo" | "tags"

export const UNGROUPED = "__ungrouped__"
const UNGROUPED_LABEL = "Not in a track"

/** "04 · Window functions" — the module's own position, zero-padded. */
function moduleLabel(position: number, title: string): string {
    return `${String(position).padStart(2, "0")} · ${title}`
}

function matchesFilter(problem: PanelProblem, needle: string): boolean {
    if (!needle) return true
    return (
        problem.title.toLowerCase().includes(needle) ||
        String(problem.number) === needle
    )
}

function summarise(key: string, label: string, problems: PanelProblem[]): PanelGroup {
    return {
        key,
        label,
        done: problems.filter((p) => p.solved).length,
        total: problems.length,
        problems,
    }
}

/**
 * Group the panel's problems for display.
 *
 * Filtering happens BEFORE grouping, deliberately: `done`/`total` describe
 * what is actually on screen, so a group header never claims a count the
 * learner cannot see. Same reason `todo` mode drops groups that empty out
 * rather than rendering "0/0".
 *
 * Problems with no curriculum module always land in a final UNGROUPED bucket
 * ordered by problem number — the panel is the whole published catalog, not
 * just the current track, so that bucket is normal rather than exceptional.
 */
export function buildPanelGroups(
    problems: PanelProblem[],
    mode: PanelMode,
    filter: string
): PanelGroup[] {
    const needle = filter.trim().toLowerCase()

    // Never mutate the caller's array — it is server-fetched data that other
    // consumers on the page share.
    let visible = problems.filter((p) => matchesFilter(p, needle))
    if (mode === "todo") visible = visible.filter((p) => !p.solved)

    if (mode === "tags") return groupByTag(visible)
    return groupByModule(visible)
}

function groupByModule(problems: PanelProblem[]): PanelGroup[] {
    const byModule = new Map<string, PanelProblem[]>()
    const ungrouped: PanelProblem[] = []
    const positions = new Map<string, { position: number; title: string }>()

    for (const problem of problems) {
        if (problem.moduleId === null || problem.modulePosition === null) {
            ungrouped.push(problem)
            continue
        }
        // Order within a module is the caller's — it supplies curriculum
        // order, and re-sorting here would silently override it.
        const bucket = byModule.get(problem.moduleId)
        if (bucket) bucket.push(problem)
        else byModule.set(problem.moduleId, [problem])
        positions.set(problem.moduleId, {
            position: problem.modulePosition,
            title: problem.moduleTitle ?? "",
        })
    }

    const groups = [...byModule.entries()]
        .sort((a, b) => positions.get(a[0])!.position - positions.get(b[0])!.position)
        .map(([moduleId, members]) => {
            const meta = positions.get(moduleId)!
            return summarise(moduleId, moduleLabel(meta.position, meta.title), members)
        })

    if (ungrouped.length > 0) {
        groups.push(
            summarise(
                UNGROUPED,
                UNGROUPED_LABEL,
                [...ungrouped].sort((a, b) => a.number - b.number)
            )
        )
    }
    return groups
}

function groupByTag(problems: PanelProblem[]): PanelGroup[] {
    const byTag = new Map<string, PanelProblem[]>()
    const untagged: PanelProblem[] = []

    for (const problem of problems) {
        if (problem.tags.length === 0) {
            untagged.push(problem)
            continue
        }
        // A problem with two tags appears under both — the panel is a way to
        // find work, not a partition.
        for (const tag of problem.tags) {
            const bucket = byTag.get(tag)
            if (bucket) bucket.push(problem)
            else byTag.set(tag, [problem])
        }
    }

    const groups = [...byTag.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([tag, members]) => summarise(tag, tag, members))

    if (untagged.length > 0) {
        groups.push(
            summarise(
                UNGROUPED,
                UNGROUPED_LABEL,
                [...untagged].sort((a, b) => a.number - b.number)
            )
        )
    }
    return groups
}
