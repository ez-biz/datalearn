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
 * This map is the SOURCE OF TRUTH for tab placement, not a description
 * of today's card layout. A field's tab here determines which tab
 * Task 10's restructure must render it on — not the other way round.
 * That matters for three fields that don't live in the Basics card
 * today: `schemaDescription` currently sits in the "Basics" card but is
 * routed to `schema` (its content is dataset-descriptive prose);
 * `tagSlugs` (today's own "Tags" card) and `discussionMode` (today's
 * own "Discussion" card) have no dedicated tab in the five-tab design
 * and are routed to `basics` as the general problem-settings tab.
 * Leaving any of the three unmapped would mean a real, submittable
 * field has no tab at all — a rejected save with nothing highlighted
 * anywhere — which is worse than a placement someone might disagree
 * with. Task 10 places these three fields on the tabs listed here.
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
 *
 * Callers pass the first path segment, not a dotted path. A nested Zod
 * issue for the inline-schema object reports `path: ["schemaInline",
 * "name"]`; pass `"schemaInline"` (`path[0]`), not `"schemaInline.name"`
 * — the latter isn't a key in the map and would silently return `null`,
 * routing nowhere.
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
 *
 * Pass first path segments, not dotted paths: a Zod issue path of
 * `["schemaInline", "name"]` should contribute `"schemaInline"` to
 * `fields`, not the joined string `"schemaInline.name"` — the map has
 * no dotted keys, so a dotted string is unmapped and silently ignored.
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
