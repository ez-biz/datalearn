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
    expectedOutput: z.string().min(2).max(2_000_000).optional(),
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
    .refine((v) => Boolean(v.expectedOutput), {
        message: "expectedOutput JSON is required.",
        path: ["expectedOutput"],
    })
    .refine(
        (v) => {
            if (!v.expectedOutput) return true
            try {
                const parsed = JSON.parse(v.expectedOutput)
                return Array.isArray(parsed)
            } catch {
                return false
            }
        },
        {
            message: "expectedOutput must be a JSON array of row objects.",
            path: ["expectedOutput"],
        }
    )

export const ProblemUpdateInput = z.object({
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
    solutionSql: z.string().max(20_000).optional().nullable(),
})

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
