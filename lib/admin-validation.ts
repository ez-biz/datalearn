// Validators here are imported by the MCP server (mcp-server/) via a
// relative path. Keep this module Prisma-free and server-runtime-free —
// pure Zod only. Anything else will break the MCP bundle.

import { z } from "zod"

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const SlugSchema = z
    .string()
    .min(1)
    .max(120)
    .regex(slugRegex, "Slug must be lowercase letters, digits, and hyphens.")

export const Difficulty = z.enum(["EASY", "MEDIUM", "HARD"])
export const ProblemStatus = z.enum(["DRAFT", "BETA", "PUBLISHED", "ARCHIVED"])
export const Dialect = z.enum(["DUCKDB", "POSTGRES"])
export const ProblemReportKind = z.enum([
    "WRONG_ANSWER",
    "UNCLEAR_DESCRIPTION",
    "BROKEN_SCHEMA",
    "TYPO",
    "OTHER",
])

export const SqlSchemaCreateInput = z.object({
    name: z.string().min(1).max(100),
    sql: z.string().min(1).max(50_000),
})
export const SqlSchemaUpdateInput = SqlSchemaCreateInput.partial()

export const TagCreateInput = z.object({
    name: z.string().min(1).max(50),
    slug: SlugSchema.optional(),
})

/**
 * Base shape for creating a SQL problem. Cross-field invariants
 * (mutually-exclusive schemaId/schemaInline, expectedOutput required,
 * expectedOutput is a JSON array) are layered on via `.refine()` in
 * `ProblemCreateInput` below.
 *
 * Exported as a bare `ZodObject` so consumers can `.omit()` / read `.shape`
 * without losing typing — `.refine()` produces a `ZodEffects`, which
 * doesn't expose those.
 */
/**
 * Per-dialect record schemas. `solutions` keys must match `dialects[]`;
 * each value is the canonical SQL for that engine. `expectedOutputs`
 * mirrors the shape with JSON-stringified row arrays. Both are
 * v0.5.0+ — the legacy single-field `solutionSql` / `expectedOutput`
 * remain accepted during the transition window.
 */
const SolutionsRecord = z.record(Dialect, z.string().max(20_000))
const ExpectedOutputsRecord = z.record(
    Dialect,
    z.string().min(2).max(2_000_000)
)

export const ProblemCreateInputBase = z.object({
    title: z.string().min(1).max(200),
    slug: SlugSchema,
    difficulty: Difficulty,
    status: ProblemStatus.default("DRAFT"),
    description: z.string().min(1).max(20_000),
    schemaDescription: z.string().max(2_000).default(""),
    ordered: z.boolean().default(false),
    /**
     * Engines this problem can be solved in. At least one is required.
     * Default `[DUCKDB, POSTGRES]` — most problems are portable. Authors
     * should narrow only when the canonical solution uses dialect-specific
     * syntax.
     */
    dialects: z.array(Dialect).min(1).max(2).default(["DUCKDB", "POSTGRES"]),
    hints: z.array(z.string().min(1).max(2_000)).max(10).default([]),
    tagSlugs: z.array(SlugSchema).max(10).default([]),
    schemaId: z.string().min(1).optional(),
    schemaInline: SqlSchemaCreateInput.optional(),
    /**
     * v0.5.0+ canonical shape: per-dialect map of SQL solutions.
     * Either this OR the legacy `solutionSql` must be provided.
     */
    solutions: SolutionsRecord.optional(),
    /**
     * v0.5.0+ canonical shape: per-dialect map of expectedOutput JSON
     * strings. Either this OR the legacy `expectedOutput` must be
     * provided. Each value must parse as a JSON array.
     */
    expectedOutputs: ExpectedOutputsRecord.optional(),
    /** @deprecated v0.5.0 — use `expectedOutputs`. Removed in v0.5.1. */
    expectedOutput: z.string().min(2).max(2_000_000).optional(),
    /** @deprecated v0.5.0 — use `solutions`. Removed in v0.5.1. */
    solutionSql: z.string().max(20_000).optional(),
})

export const ProblemCreateInput = ProblemCreateInputBase
    .refine(
        (v) => Boolean(v.schemaId) !== Boolean(v.schemaInline),
        {
            message: "Provide exactly one of schemaId or schemaInline.",
            path: ["schemaId"],
        }
    )
    // Either the new per-dialect map OR the legacy single field must
    // be present. The API layer synthesizes one from the other before
    // writing to the DB.
    .refine(
        (v) =>
            Boolean(v.expectedOutput) ||
            (v.expectedOutputs && Object.keys(v.expectedOutputs).length > 0),
        {
            message:
                "expectedOutput (legacy) or expectedOutputs (per-dialect) is required.",
            path: ["expectedOutputs"],
        }
    )
    // If the legacy field is given, it must parse as an array.
    .refine(
        (v) => {
            if (!v.expectedOutput) return true
            try {
                return Array.isArray(JSON.parse(v.expectedOutput))
            } catch {
                return false
            }
        },
        {
            message: "expectedOutput must be a JSON array of row objects.",
            path: ["expectedOutput"],
        }
    )
    // If the new map is given, every value must parse as an array.
    .refine(
        (v) => {
            if (!v.expectedOutputs) return true
            for (const [, val] of Object.entries(v.expectedOutputs)) {
                try {
                    if (!Array.isArray(JSON.parse(val))) return false
                } catch {
                    return false
                }
            }
            return true
        },
        {
            message:
                "Every value in expectedOutputs must be a JSON array of row objects.",
            path: ["expectedOutputs"],
        }
    )
    // If `dialects` is provided alongside per-dialect maps, every key
    // in the maps must be a listed dialect. Extra keys (e.g.
    // `solutions.MYSQL` when MYSQL isn't in `dialects`) are rejected
    // to keep the data shape clean.
    .refine(
        (v) => {
            if (!v.solutions) return true
            return Object.keys(v.solutions).every((d) =>
                v.dialects.includes(d as z.infer<typeof Dialect>)
            )
        },
        {
            message:
                "solutions has a key that is not in dialects[]. Add the dialect to dialects[] or drop the key.",
            path: ["solutions"],
        }
    )
    .refine(
        (v) => {
            if (!v.expectedOutputs) return true
            return Object.keys(v.expectedOutputs).every((d) =>
                v.dialects.includes(d as z.infer<typeof Dialect>)
            )
        },
        {
            message:
                "expectedOutputs has a key that is not in dialects[].",
            path: ["expectedOutputs"],
        }
    )
    // PUBLISHED problems must have a non-empty solution + expectedOutput
    // for every dialect they advertise. DRAFT/BETA/ARCHIVED tolerate
    // partial population (legacy data, in-progress authoring).
    .refine(
        (v) => {
            if (v.status !== "PUBLISHED") return true
            for (const d of v.dialects) {
                const sol = v.solutions?.[d] ?? v.solutionSql
                const exp = v.expectedOutputs?.[d] ?? v.expectedOutput
                if (!sol || sol.trim().length === 0) return false
                if (!exp || exp.trim().length === 0) return false
            }
            return true
        },
        {
            message:
                "PUBLISHED requires a non-empty solution + expectedOutput for every dialect listed in dialects[].",
            path: ["status"],
        }
    )

/**
 * Bare ZodObject for ProblemUpdateInput so MCP tools can `.shape` /
 * `.pick()` individual fields. The refined version lives in
 * `ProblemUpdateInput` below — same fields, plus the cross-field
 * refines.
 */
export const ProblemUpdateInputBase = z.object({
    title: z.string().min(1).max(200).optional(),
    slug: SlugSchema.optional(),
    difficulty: Difficulty.optional(),
    status: ProblemStatus.optional(),
    description: z.string().min(1).max(20_000).optional(),
    schemaDescription: z.string().max(2_000).optional(),
    ordered: z.boolean().optional(),
    dialects: z.array(Dialect).min(1).max(2).optional(),
    hints: z.array(z.string().min(1).max(2_000)).max(10).optional(),
    tagSlugs: z.array(SlugSchema).max(10).optional(),
    schemaId: z.string().min(1).optional(),
    /** v0.5.0+ canonical shape; PATCH replaces the whole map. */
    solutions: SolutionsRecord.optional(),
    /** v0.5.0+ canonical shape; PATCH replaces the whole map. */
    expectedOutputs: ExpectedOutputsRecord.optional(),
    /** @deprecated v0.5.0 — use `expectedOutputs`. */
    expectedOutput: z
        .string()
        .min(2)
        .max(2_000_000)
        .refine(
            (v) => {
                try {
                    return Array.isArray(JSON.parse(v))
                } catch {
                    return false
                }
            },
            { message: "expectedOutput must be a JSON array." }
        )
        .optional(),
    /** @deprecated v0.5.0 — use `solutions`. */
    solutionSql: z.string().max(20_000).optional().nullable(),
})

export const ProblemUpdateInput = ProblemUpdateInputBase
    .refine(
        (v) => {
            if (!v.expectedOutputs) return true
            for (const [, val] of Object.entries(v.expectedOutputs)) {
                try {
                    if (!Array.isArray(JSON.parse(val))) return false
                } catch {
                    return false
                }
            }
            return true
        },
        {
            message:
                "Every value in expectedOutputs must be a JSON array of row objects.",
            path: ["expectedOutputs"],
        }
    )

/**
 * Reconcile legacy single-field and v0.5.0 per-dialect-map inputs into
 * BOTH shapes so we can write to both columns during the transition.
 *
 * - `solutions` map: the source of truth going forward. Keys = dialects.
 * - `expectedOutputs` map: same shape, JSON-stringified row arrays.
 * - `legacySolution`: a single string written to the legacy `solutionSql`
 *   column. Picked from the per-dialect map (first listed dialect) when
 *   author provides only the new shape.
 * - `legacyExpected`: same idea for the legacy `expectedOutput` column.
 *
 * Cleanup pass in v0.5.1 will drop both legacy fields and this helper
 * collapses to "use the maps directly."
 */
export function synthesizeBothShapes(input: {
    dialects: ("DUCKDB" | "POSTGRES")[]
    solutions?: Record<string, string>
    expectedOutputs?: Record<string, string>
    solutionSql?: string | null
    expectedOutput?: string
}): {
    solutions: Record<string, string>
    expectedOutputs: Record<string, string>
    legacySolution: string | null
    legacyExpected: string
} {
    const solutions: Record<string, string> = { ...(input.solutions ?? {}) }
    const expectedOutputs: Record<string, string> = {
        ...(input.expectedOutputs ?? {}),
    }

    // Fill missing per-dialect entries from the legacy single fields.
    if (input.solutionSql !== undefined && input.solutionSql !== null) {
        for (const d of input.dialects) {
            if (solutions[d] === undefined) solutions[d] = input.solutionSql
        }
    }
    if (input.expectedOutput !== undefined) {
        for (const d of input.dialects) {
            if (expectedOutputs[d] === undefined)
                expectedOutputs[d] = input.expectedOutput
        }
    }

    // Pick a representative legacy value (preferring the input's
    // explicit legacy field, falling back to the first listed dialect's
    // entry from the new map).
    const firstDialect = input.dialects[0]
    const legacySolution: string | null =
        input.solutionSql !== undefined && input.solutionSql !== null
            ? input.solutionSql
            : firstDialect && solutions[firstDialect]
                ? solutions[firstDialect]
                : null
    const legacyExpected: string =
        input.expectedOutput !== undefined
            ? input.expectedOutput
            : firstDialect && expectedOutputs[firstDialect]
                ? expectedOutputs[firstDialect]
                : ""

    return { solutions, expectedOutputs, legacySolution, legacyExpected }
}

export const ApiKeyCreateInput = z.object({
    name: z.string().min(1).max(100),
    expiresAt: z.coerce.date().optional(),
})

export const ProblemReportCreateInput = z.object({
    problemSlug: SlugSchema,
    kind: ProblemReportKind,
    message: z.string().min(1).max(4_000),
})

export const UserRoleSchema = z.enum(["USER", "CONTRIBUTOR", "ADMIN"])

export const UserRoleUpdateInput = z.object({
    role: UserRoleSchema,
})

// ----- Learn (topics + articles) -----

export const ArticleStatus = z.enum([
    "DRAFT",
    "SUBMITTED",
    "PUBLISHED",
    "ARCHIVED",
])

export const TopicCreateInput = z.object({
    name: z.string().min(1).max(100),
    slug: SlugSchema,
    description: z.string().max(2_000).optional().nullable(),
})
export const TopicUpdateInput = TopicCreateInput.partial()

export const ArticleCreateInput = z.object({
    title: z.string().min(1).max(200),
    slug: SlugSchema,
    topicSlug: SlugSchema,
    content: z.string().min(1).max(200_000),
    summary: z.string().max(2_000).optional().nullable(),
    status: ArticleStatus.default("DRAFT"),
    tagSlugs: z.array(SlugSchema).max(10).default([]),
    relatedProblemSlugs: z.array(SlugSchema).max(20).default([]),
})

export const ArticleUpdateInput = z.object({
    title: z.string().min(1).max(200).optional(),
    slug: SlugSchema.optional(),
    topicSlug: SlugSchema.optional(),
    content: z.string().min(1).max(200_000).optional(),
    summary: z.string().max(2_000).optional().nullable(),
    status: ArticleStatus.optional(),
    tagSlugs: z.array(SlugSchema).max(10).optional(),
    relatedProblemSlugs: z.array(SlugSchema).max(20).optional(),
})

export const ArticleRejectInput = z.object({
    reviewNotes: z.string().min(1).max(4_000),
})

/**
 * words / 200 wpm, rounded up. Strips markdown punctuation crudely
 * — perfect-is-the-enemy-of-good for a reading-time pill.
 */
export function computeReadingMinutes(content: string): number {
    const words = content
        .replace(/```[\s\S]*?```/g, " ") // strip fenced code
        .replace(/[#>*_~`\[\]\(\)\-]/g, " ")
        .split(/\s+/)
        .filter(Boolean).length
    return Math.max(1, Math.ceil(words / 200))
}

export function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)
}
