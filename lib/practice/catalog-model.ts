// Pure filter/sort/facet model for the practice catalog. No React, no
// Prisma, no DOM — same contract as
// lib/workspace/problems-panel-model.ts: this decides what the catalog's
// rows and facet rail look like, the page only renders the result.

import type { CatalogProblem } from "@/lib/practice/catalog-read"

export type CatalogSort = "curriculum" | "newest" | "pass-rate"

export type CatalogFilters = {
    status: ("solved" | "attempted" | "todo")[]
    difficulty: ("EASY" | "MEDIUM" | "HARD")[]
    engine: ("DUCKDB" | "POSTGRES")[]
    topics: string[]
    companies: string[]
    search: string
}

export type FacetCount = { value: string; label: string; count: number }

export type CatalogFacets = {
    status: FacetCount[]
    difficulty: FacetCount[]
    engine: FacetCount[]
    topics: FacetCount[]
    companies: FacetCount[]
}

export const EMPTY_FILTERS: CatalogFilters = {
    status: [],
    difficulty: [],
    engine: [],
    topics: [],
    companies: [],
    search: "",
}

const STATUS_OPTIONS: { value: CatalogFilters["status"][number]; label: string }[] = [
    { value: "solved", label: "Solved" },
    { value: "attempted", label: "Attempted" },
    { value: "todo", label: "Todo" },
]

const DIFFICULTY_OPTIONS: { value: CatalogFilters["difficulty"][number]; label: string }[] = [
    { value: "EASY", label: "Easy" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HARD", label: "Hard" },
]

const ENGINE_OPTIONS: { value: CatalogFilters["engine"][number]; label: string }[] = [
    { value: "DUCKDB", label: "DuckDB" },
    { value: "POSTGRES", label: "Postgres" },
]

/**
 * `solved`/`attempted`/`todo` partition the catalog: a problem with an
 * accepted submission is `solved` even if it also has failed attempts, and
 * `attempted` means "tried, not yet accepted" rather than "has any
 * submission" — so the three statuses never overlap.
 */
function statusOf(problem: CatalogProblem): CatalogFilters["status"][number] {
    if (problem.solved) return "solved"
    if (problem.attempted) return "attempted"
    return "todo"
}

function matchesStatus(problem: CatalogProblem, selected: CatalogFilters["status"]): boolean {
    if (selected.length === 0) return true
    return selected.includes(statusOf(problem))
}

function matchesDifficulty(
    problem: CatalogProblem,
    selected: CatalogFilters["difficulty"]
): boolean {
    if (selected.length === 0) return true
    return selected.includes(problem.difficulty)
}

/** A problem matches an engine facet if it supports that engine at all. */
function matchesEngine(problem: CatalogProblem, selected: CatalogFilters["engine"]): boolean {
    if (selected.length === 0) return true
    return problem.dialects.some((d) => selected.includes(d))
}

function matchesTopics(problem: CatalogProblem, selected: string[]): boolean {
    if (selected.length === 0) return true
    return problem.topicTags.some((t) => selected.includes(t.slug))
}

function matchesCompanies(problem: CatalogProblem, selected: string[]): boolean {
    if (selected.length === 0) return true
    return problem.companyTags.some((c) => selected.includes(c.slug))
}

function matchesSearch(problem: CatalogProblem, search: string): boolean {
    const needle = search.trim().toLowerCase()
    if (!needle) return true
    return problem.title.toLowerCase().includes(needle) || String(problem.number) === needle
}

/**
 * Apply every filter group except `except` (plus search, which has no
 * facet rail of its own). Shared by filterCatalog (except = none of them,
 * via matchesAll below) and computeFacets, where each group's counts must
 * come from the OTHER groups' selections only — see computeFacets' doc.
 */
function matchesAllExcept(
    problem: CatalogProblem,
    filters: CatalogFilters,
    except: keyof CatalogFacets | null
): boolean {
    if (except !== "status" && !matchesStatus(problem, filters.status)) return false
    if (except !== "difficulty" && !matchesDifficulty(problem, filters.difficulty)) return false
    if (except !== "engine" && !matchesEngine(problem, filters.engine)) return false
    if (except !== "topics" && !matchesTopics(problem, filters.topics)) return false
    if (except !== "companies" && !matchesCompanies(problem, filters.companies)) return false
    return matchesSearch(problem, filters.search)
}

/** modulePosition ascending, null (no curriculum module) last, then number. */
function compareCurriculum(a: CatalogProblem, b: CatalogProblem): number {
    if (a.modulePosition === null && b.modulePosition === null) return a.number - b.number
    if (a.modulePosition === null) return 1
    if (b.modulePosition === null) return -1
    if (a.modulePosition !== b.modulePosition) return a.modulePosition - b.modulePosition
    return a.number - b.number
}

function compareNewest(a: CatalogProblem, b: CatalogProblem): number {
    return b.createdAt.getTime() - a.createdAt.getTime()
}

/**
 * Hardest first (lowest accepted/attempted ratio), unattempted problems
 * last. An unattempted problem has no rate at all — sorting it as 0% would
 * claim it's the hardest problem in the catalog, which it isn't, it's just
 * unmeasured.
 */
function comparePassRate(a: CatalogProblem, b: CatalogProblem): number {
    const aUntried = a.attemptCount === 0
    const bUntried = b.attemptCount === 0
    if (aUntried && bUntried) return 0
    if (aUntried) return 1
    if (bUntried) return -1
    return a.acceptedCount / a.attemptCount - b.acceptedCount / b.attemptCount
}

/**
 * Filter the catalog by every group (an intersection across groups, a
 * union within a group's own selections) and sort the result. Returns a
 * new array — the caller's array (server-fetched data other consumers on
 * the page share) is never mutated.
 */
export function filterCatalog(
    problems: CatalogProblem[],
    filters: CatalogFilters,
    sort: CatalogSort
): CatalogProblem[] {
    const filtered = problems.filter((p) => matchesAllExcept(p, filters, null))
    if (sort === "curriculum") filtered.sort(compareCurriculum)
    else if (sort === "newest") filtered.sort(compareNewest)
    else filtered.sort(comparePassRate)
    return filtered
}

function countBy<T extends string>(
    problems: CatalogProblem[],
    filters: CatalogFilters,
    except: keyof CatalogFacets,
    tagsOf: (p: CatalogProblem) => T[]
): Map<T, number> {
    const counts = new Map<T, number>()
    for (const problem of problems) {
        if (!matchesAllExcept(problem, filters, except)) continue
        for (const tag of tagsOf(problem)) counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
    return counts
}

/**
 * Same job as `countBy`, for the two tag groups: `topicTags`/`companyTags`
 * are `{slug, name}[]`, not plain strings, and the facet needs both — the
 * slug as the stable filter/count key (so a renamed tag doesn't silently
 * stop matching an already-selected filter), the name as what's shown.
 * Every occurrence of a slug carries the same name, so keeping the first
 * one seen is enough.
 */
function countTagsBy(
    problems: CatalogProblem[],
    filters: CatalogFilters,
    except: keyof CatalogFacets,
    tagsOf: (p: CatalogProblem) => { slug: string; name: string }[]
): Map<string, { name: string; count: number }> {
    const counts = new Map<string, { name: string; count: number }>()
    for (const problem of problems) {
        if (!matchesAllExcept(problem, filters, except)) continue
        for (const tag of tagsOf(problem)) {
            const existing = counts.get(tag.slug)
            if (existing) existing.count += 1
            else counts.set(tag.slug, { name: tag.name, count: 1 })
        }
    }
    return counts
}

function sortedTagFacetList(counts: Map<string, { name: string; count: number }>): FacetCount[] {
    return [...counts.entries()]
        .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
        .map(([slug, { name, count }]) => ({ value: slug, label: name, count }))
}

/**
 * The facet rail's counts.
 *
 * Each group's counts are computed against the problems filtered by every
 * OTHER group, but NOT by that group's own selection. If selecting EASY
 * made the MEDIUM count read 0, the rail would tell the learner there is
 * nothing else to pick — a facet option's count answers "how many problems
 * would this add", not "how many problems currently match".
 *
 * Status, difficulty and engine always list every option, even at zero, so
 * the rail's shape never changes as filters are toggled. Topics and
 * companies list only tags present in the (other-group-filtered) result,
 * ordered by count descending then name, since the tag universe is
 * open-ended and an all-zero long tail would be noise. Their `value` is the
 * tag's slug (what filtering matches on); `label` is the display name.
 */
export function computeFacets(
    problems: CatalogProblem[],
    filters: CatalogFilters
): CatalogFacets {
    const statusCounts = countBy(problems, filters, "status", (p) => [statusOf(p)])
    const difficultyCounts = countBy(problems, filters, "difficulty", (p) => [p.difficulty])
    const engineCounts = countBy(problems, filters, "engine", (p) => p.dialects)
    const topicCounts = countTagsBy(problems, filters, "topics", (p) => p.topicTags)
    const companyCounts = countTagsBy(problems, filters, "companies", (p) => p.companyTags)

    return {
        status: STATUS_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: statusCounts.get(o.value) ?? 0,
        })),
        difficulty: DIFFICULTY_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: difficultyCounts.get(o.value) ?? 0,
        })),
        engine: ENGINE_OPTIONS.map((o) => ({
            value: o.value,
            label: o.label,
            count: engineCounts.get(o.value) ?? 0,
        })),
        topics: sortedTagFacetList(topicCounts),
        companies: sortedTagFacetList(companyCounts),
    }
}
