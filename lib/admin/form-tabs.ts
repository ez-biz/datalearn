// Pure tab-identity and error-routing model for the admin problem form.
// No Prisma, no React, no next/*, no DOM — importable from a plain
// `node --import tsx --test` run with no database.
//
// Tabs hide content. An invalid field on a hidden tab, with nothing
// marking that tab, gives the author no visible reason their save was
// rejected — on the screen most central to the whole admin surface. This
// module is what makes tabs safe: it maps each field to the tab that
// owns it, so the tab strip can mark errors and a failed save can jump
// to the first offending tab.

export type FormTabId = "basics" | "schema" | "solution" | "hints" | "curriculum"

export const FORM_TABS: { id: FormTabId; label: string }[] = [
    { id: "basics", label: "Basics" },
    { id: "schema", label: "Schema" },
    { id: "solution", label: "Solution & expected" },
    { id: "hints", label: "Hints" },
    { id: "curriculum", label: "Curriculum" },
]

/**
 * Field name -> owning tab. Keys match the payload/Zod field names in
 * `lib/admin-validation.ts` (`ProblemCreateInputBase` /
 * `ProblemUpdateInputBase`) — the names a server validation error would
 * report — plus `discussionMode` (validated separately in the PATCH
 * route, see `app/api/admin/problems/[slug]/route.ts`) and
 * `curriculumLessonId`. That last one is a FORM field name, not a
 * database column: there is deliberately no `lessonId` column on
 * `SQLProblem`, the problem-to-lesson binding lives in the existing
 * `LessonCheckpoint` relation. It's mapped here ahead of Task 11 wiring
 * it into the form.
 *
 * Two entries are judgment calls, not obvious reads — flagged in
 * task-9-report.md for confirmation before Task 10 places them:
 *  - `schemaDescription` renders inside today's "Basics" card, but its
 *    content ("Short prose about the dataset") is schema-descriptive, so
 *    it's routed to `schema` here.
 *  - `tagSlugs` and `discussionMode` have no dedicated tab in the
 *    5-tab design; both fall back to `basics` as the general
 *    problem-settings tab.
 */
const FIELD_TAB_MAP: Record<string, FormTabId> = {
    // Basics
    title: "basics",
    slug: "basics",
    difficulty: "basics",
    status: "basics",
    description: "basics",
    ordered: "basics",
    dialects: "basics",
    tagSlugs: "basics",
    discussionMode: "basics",

    // Schema
    schemaDescription: "schema",
    schemaId: "schema",
    schemaInline: "schema",

    // Solution & expected output
    solutionSql: "solution",
    expectedOutput: "solution",
    solutions: "solution",
    expectedOutputs: "solution",

    // Hints
    hints: "hints",

    // Curriculum (Task 11)
    curriculumLessonId: "curriculum",
}

/**
 * Which tab owns a given form field. Returns `null` for anything
 * unmapped — deliberately not a default to `"basics"`, because a
 * silently mis-routed error is exactly the failure tabs introduce: the
 * author would land on a tab where nothing is actually wrong.
 */
export function tabForField(field: string): FormTabId | null {
    return FIELD_TAB_MAP[field] ?? null
}

const TAB_ORDER: FormTabId[] = FORM_TABS.map((t) => t.id)

/**
 * Tabs containing at least one errored field, in tab order (not the
 * order the field names were given), de-duplicated. Unmapped field
 * names are ignored rather than raising — the caller is expected to be
 * a list of server-reported field names, some of which may not be
 * form-visible.
 */
export function tabsWithErrors(fields: string[]): FormTabId[] {
    const errored = new Set<FormTabId>()
    for (const field of fields) {
        const tab = tabForField(field)
        if (tab) errored.add(tab)
    }
    return TAB_ORDER.filter((tab) => errored.has(tab))
}

/**
 * The tab a failed save should switch to — the earliest errored tab in
 * tab order — or `null` when nothing errored.
 */
export function firstErroredTab(fields: string[]): FormTabId | null {
    return tabsWithErrors(fields)[0] ?? null
}
