import { z } from "zod"

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const SlugSchema = z
    .string()
    .min(1)
    .max(120)
    .regex(slugRegex, "Slug must be lowercase letters, digits, and hyphens.")

export const Difficulty = z.enum(["EASY", "MEDIUM", "HARD"])

export const SqlSchemaCreateInput = z.object({
    name: z.string().min(1).max(100),
    sql: z.string().min(1).max(50_000),
})
export const SqlSchemaUpdateInput = SqlSchemaCreateInput.partial()

export const TagCreateInput = z.object({
    name: z.string().min(1).max(50),
    slug: SlugSchema.optional(),
})

export const ProblemCreateInput = z
    .object({
        title: z.string().min(1).max(200),
        slug: SlugSchema,
        difficulty: Difficulty,
        description: z.string().min(1).max(20_000),
        schemaDescription: z.string().max(2_000).default(""),
        ordered: z.boolean().default(false),
        hints: z.array(z.string().min(1).max(2_000)).max(10).default([]),
        tagSlugs: z.array(SlugSchema).max(10).default([]),
        // schema: either pick existing by id, or inline-create
        schemaId: z.string().min(1).optional(),
        schemaInline: SqlSchemaCreateInput.optional(),
        // expectedOutput: either provide JSON directly, or provide solutionSql to be run client-side
        expectedOutput: z.string().min(2).max(2_000_000).optional(),
        solutionSql: z.string().max(20_000).optional(),
    })
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
    description: z.string().min(1).max(20_000).optional(),
    schemaDescription: z.string().max(2_000).optional(),
    ordered: z.boolean().optional(),
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

export function slugify(input: string): string {
    return input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120)
}
