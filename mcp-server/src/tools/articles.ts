import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
    ArticleCreateInput,
    ArticleUpdateInput,
    SlugSchema,
    validateArticleDirectivesSyntactic,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Article = {
    id: string
    slug: string
    title: string
    status: "DRAFT" | "SUBMITTED" | "PUBLISHED" | "ARCHIVED"
    topicSlug?: string
    summary: string | null
    hasVisualBlocks?: boolean
    content?: string
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

// MCP input shape for create_article — omits `status` so the AI cannot
// publish without human review. Handler hardcodes status="DRAFT" after
// spreading input. Same DRAFT-guard pattern as create_problem
// (see CLAUDE.md: "Don't bypass the MCP create_problem DRAFT guard").
const McpArticleCreateInputShape = ArticleCreateInput.omit({
    status: true,
}).shape

const McpArticleUpdateInputShape = {
    slug: SlugSchema,
    title: ArticleUpdateInput.shape.title,
    newSlug: SlugSchema.optional(),
    topicSlug: ArticleUpdateInput.shape.topicSlug,
    content: ArticleUpdateInput.shape.content,
    summary: ArticleUpdateInput.shape.summary,
    status: ArticleUpdateInput.shape.status,
    tagSlugs: ArticleUpdateInput.shape.tagSlugs,
    relatedProblemSlugs: ArticleUpdateInput.shape.relatedProblemSlugs,
}

const ListArticlesShape = {
    topicSlug: SlugSchema.optional(),
    status: z
        .enum(["DRAFT", "SUBMITTED", "PUBLISHED", "ARCHIVED"])
        .optional(),
}

/**
 * Best-effort client-side directive check. The server still runs Layer 2
 * (Prisma-aware) on every PUBLISHED transition; this is just to surface
 * obvious problems (missing alt, foreign URLs, bad callout kind) before
 * the network round-trip.
 */
function preCheckDirectives(content: string | undefined): string[] {
    if (typeof content !== "string" || content.length === 0) return []
    const result = validateArticleDirectivesSyntactic(content)
    if (result.ok) return []
    return result.errors.map(
        (e) => `${e.directive}#${e.index}: ${e.message}`
    )
}

export function registerArticleTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_articles",
        [
            "List Learn articles. Returns a minimal projection (slug, title, status, topicSlug, hasVisualBlocks).",
            "Use get_article to fetch a single article's full content.",
            "Optional filter: topicSlug (kebab-case) and/or status (DRAFT|SUBMITTED|PUBLISHED|ARCHIVED).",
        ].join("\n"),
        ListArticlesShape,
        async (input) => {
            try {
                const url = new URLSearchParams()
                if (input.status) url.set("status", input.status)
                const path = url.toString()
                    ? `/api/admin/articles?${url.toString()}`
                    : "/api/admin/articles"
                const articles = await client.request<Article[]>("GET", path)
                const filtered = input.topicSlug
                    ? articles.filter((a) => a.topicSlug === input.topicSlug)
                    : articles
                const projected = filtered.map((a) => ({
                    slug: a.slug,
                    title: a.title,
                    status: a.status,
                    topicSlug: a.topicSlug,
                    hasVisualBlocks: a.hasVisualBlocks ?? false,
                    summary: a.summary,
                }))
                return ok(projected)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "get_article",
        [
            "Fetch a single article's full record by slug, including `content` (markdown source).",
            "Returns {found:false} if no article exists at that slug.",
            "",
            "IMPORTANT for edits: update_article REPLACES the fields you pass — content edits should be read-modify-write, not delta. Always get_article first, then send the full modified content back through update_article.",
        ].join("\n"),
        { slug: SlugSchema },
        async ({ slug }) => {
            try {
                const article = await client.request<Article>(
                    "GET",
                    `/api/admin/articles/${encodeURIComponent(slug)}`
                )
                return ok(article)
            } catch (err) {
                if (err instanceof ApiError && err.status === 404) {
                    return ok({ found: false })
                }
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_article",
        [
            "Create a new Learn article. ALWAYS lands as DRAFT — publishing is a deliberate human action via the admin UI or update_article; this tool does not accept a status field.",
            "",
            "Required: title, slug (kebab-case), topicSlug (must reference an existing Topic — call list_topics first), content (markdown).",
            "",
            "v0.5.0+ directive support: content can include :::figure, :::mermaid, :::steps, :::side-by-side, :::callout block directives. See `docs/superpowers/prompts/learn-v2-article-author.md` for the directive syntax + rules. Each :::figure and :::mermaid MUST have a non-empty `alt` attribute. :::figure `src` must be either a `/learn/img/...` path (repo-committed) or an `https://*.vercel-storage.com/...` URL (a human-uploaded asset).",
            "",
            "Optional: summary (≤ 2000 chars), tagSlugs (≤ 10, must reference existing Tags), relatedProblemSlugs (≤ 20, must reference existing SQLProblems).",
        ].join("\n"),
        McpArticleCreateInputShape,
        async (input) => {
            const errs = preCheckDirectives(input.content)
            if (errs.length > 0) {
                throw toMcpError(
                    new ApiError(400, {
                        error: "directive-validation",
                        errors: errs,
                    })
                )
            }
            try {
                const created = await client.request<Article>(
                    "POST",
                    "/api/admin/articles",
                    { ...input, status: "DRAFT" }
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "update_article",
        [
            "Update an existing Learn article by slug. PATCH semantics: only the fields you pass are changed.",
            "",
            "IMPORTANT — content edits are read-then-replace. The full `content` string you pass replaces the current value entirely (no merging). To make a small edit, call get_article first, mutate the content locally, then send the full result. Tag and related-problem arrays also REPLACE the existing set when present.",
            "",
            "Status transitions:",
            "  - DRAFT → SUBMITTED: contributor submitting for review. Use the admin UI for the human review step.",
            "  - SUBMITTED → PUBLISHED: admin approval. Validates Layer 2 (figure URLs must resolve to ACTIVE Asset rows owned by the article author).",
            "  - PUBLISHED → DRAFT/ARCHIVED: unpublish; safe.",
            "",
            "Re-validation: when the resulting status is PUBLISHED, the server runs Layer 2 directive validation. Foreign Blob URLs, cross-owner Asset references, and missing alt attributes are rejected.",
            "",
            "Pass `newSlug` to rename the article's slug (kebab-case, must be unique).",
        ].join("\n"),
        McpArticleUpdateInputShape,
        async (input) => {
            const errs = preCheckDirectives(input.content)
            if (errs.length > 0) {
                throw toMcpError(
                    new ApiError(400, {
                        error: "directive-validation",
                        errors: errs,
                    })
                )
            }
            const { slug, newSlug, ...rest } = input
            try {
                const body = newSlug ? { ...rest, slug: newSlug } : rest
                const updated = await client.request<Article>(
                    "PATCH",
                    `/api/admin/articles/${encodeURIComponent(slug)}`,
                    body
                )
                return ok(updated)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
