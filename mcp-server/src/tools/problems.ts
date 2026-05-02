import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
    Difficulty,
    ProblemCreateInputBase,
    ProblemUpdateInput,
    SlugSchema,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type FullProblem = {
    id: string
    number: number
    slug: string
    title: string
    difficulty: "EASY" | "MEDIUM" | "HARD"
    status: "DRAFT" | "BETA" | "PUBLISHED" | "ARCHIVED"
    description: string
    dialects?: ("DUCKDB" | "POSTGRES")[]
    expectedOutput?: string | null
    solutionSql?: string | null
    tags?: Array<{ id: string; slug: string; name: string }>
    schema?: { id: string; name: string }
}

function ok(payload: unknown) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(payload, null, 2),
            },
        ],
    }
}

// MCP input shape for create_problem — excludes `status` so the AI cannot
// set it. The handler injects status="DRAFT" before sending to the API.
// Cross-field refinements (schemaId XOR schemaInline, expectedOutput
// required, expectedOutput is a JSON array) are validated server-side
// by ProblemCreateInput; a 400 from the API maps to McpError(InvalidParams)
// with the API's message, so the AI sees the actual validation error.
const McpProblemCreateInputShape =
    ProblemCreateInputBase.omit({ status: true }).shape

const McpProblemUpdateInputShape = {
    slug: SlugSchema,
    title: ProblemUpdateInput.shape.title,
    newSlug: SlugSchema.optional(),
    description: ProblemUpdateInput.shape.description,
    difficulty: Difficulty.optional(),
    solutionSql: ProblemCreateInputBase.shape.solutionSql,
    expectedOutput: ProblemUpdateInput.shape.expectedOutput,
    hints: ProblemUpdateInput.shape.hints,
    tagSlugs: ProblemUpdateInput.shape.tagSlugs,
    ordered: ProblemUpdateInput.shape.ordered,
    schemaId: ProblemUpdateInput.shape.schemaId,
    schemaDescription: ProblemUpdateInput.shape.schemaDescription,
    dialects: ProblemUpdateInput.shape.dialects,
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
}

const ListProblemsShape = {
    difficulty: Difficulty.optional(),
}

export function registerProblemTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_problems",
        "List SQL problems. Returns a minimal projection (number, slug, title, difficulty, status, dialects, tags) — use get_problem to fetch a single problem's full data including expectedOutput. `dialects` lists which engines (DUCKDB, POSTGRES) the problem can be solved in.",
        ListProblemsShape,
        async (input) => {
            try {
                const all = await client.request<FullProblem[]>(
                    "GET",
                    "/api/admin/problems"
                )
                const filtered = input.difficulty
                    ? all.filter((p) => p.difficulty === input.difficulty)
                    : all
                const projected = filtered.map((p) => ({
                    number: p.number,
                    slug: p.slug,
                    title: p.title,
                    difficulty: p.difficulty,
                    status: p.status,
                    dialects: p.dialects ?? ["DUCKDB", "POSTGRES"],
                    tags: (p.tags ?? []).map((t) => t.slug),
                }))
                return ok(projected)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "get_problem",
        "Fetch a single SQL problem's full record by slug, including expectedOutput JSON and solutionSql. Returns {found:false} if no problem with that slug exists. Use this to learn the JSON shape of expectedOutput before authoring new problems.",
        // SlugSchema enforces kebab-case + length; rejects `.`/`..` which
        // would otherwise URL-normalize away the path segment and hit a
        // sibling endpoint (e.g. `/api/admin/problems/.` → `/api/admin/problems/`).
        { slug: SlugSchema },
        async ({ slug }) => {
            try {
                const problem = await client.request<FullProblem>(
                    "GET",
                    `/api/admin/problems/${encodeURIComponent(slug)}`
                )
                return ok(problem)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_problem",
        [
            "Create a new SQL problem. ALWAYS lands as DRAFT — publishing is a deliberate human action via the admin UI; this tool does not accept a status field.",
            "",
            "Required: title, slug (kebab-case), difficulty (EASY|MEDIUM|HARD), description, expectedOutput.",
            "Schema: provide EXACTLY ONE of schemaId (reference an existing schema; check list_schemas first) or schemaInline (create a new schema in the same call).",
            "expectedOutput: must be a JSON-stringified array of row objects. Example: '[{\"id\":1,\"name\":\"a\"}]'.",
            "Optional: hints (string[], max 10), tagSlugs (string[], max 10 — must reference existing tags).",
        ].join("\n"),
        McpProblemCreateInputShape,
        async (input) => {
            try {
                const created = await client.request<FullProblem>(
                    "POST",
                    "/api/admin/problems",
                    { ...input, status: "DRAFT" }
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "update_problem",
        "Update an existing SQL problem by slug. Only the fields you pass will be changed; omitted fields are left untouched. Use tagSlugs to replace the full tag set. Set status to ARCHIVED to hide a problem without deleting it (preserves submissions). Use newSlug to rename the problem slug. Returns the updated problem or {found: false}.",
        McpProblemUpdateInputShape,
        async (input) => {
            const { slug, newSlug, ...updates } = input
            const body = {
                ...updates,
                ...(newSlug !== undefined && { slug: newSlug }),
            }
            try {
                const updated = await client.request<FullProblem>(
                    "PATCH",
                    `/api/admin/problems/${encodeURIComponent(slug)}`,
                    body
                )
                return ok(updated)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        }
    )
}
