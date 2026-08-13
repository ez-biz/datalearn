import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import {
    CheckpointAddInput,
    CheckpointReorderInput,
    ModuleCreateInput,
    ModuleLessonAddInput,
    ModuleLessonReorderInput,
    ModuleReorderInput,
    ModuleUpdateInput,
    SlugSchema,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

function ok(payload: unknown) {
    return {
        content: [
            { type: "text" as const, text: JSON.stringify(payload, null, 2) },
        ],
    }
}

function notFound(err: unknown) {
    return err instanceof ApiError && err.status === 404
}

const enc = encodeURIComponent

export function registerCurriculumTools(
    server: McpServer,
    client: DataLearnClient,
): void {
    server.tool(
        "list_modules",
        "List a track's modules in curriculum order, with lesson counts.",
        { trackSlug: SlugSchema },
        async ({ trackSlug }) => {
            try {
                return ok(
                    await client.request(
                        "GET",
                        `/api/admin/tracks/${enc(trackSlug)}/modules`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "get_module",
        "Fetch one module by track slug + module slug, including its ordered lessons. Returns {found:false} if it does not exist.",
        { trackSlug: SlugSchema, moduleSlug: SlugSchema },
        async ({ trackSlug, moduleSlug }) => {
            try {
                return ok(
                    await client.request(
                        "GET",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "create_module",
        "Create a module in a track. Appends unless `position` is given. Creating modules NEVER publishes the track — publishing stays a deliberate human action in the admin portal.",
        {
            trackSlug: SlugSchema,
            name: ModuleCreateInput.shape.name,
            slug: ModuleCreateInput.shape.slug,
            description: ModuleCreateInput.shape.description,
            position: ModuleCreateInput.shape.position,
        },
        async ({ trackSlug, ...body }) => {
            try {
                return ok(
                    await client.request(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "update_module",
        "Rename a module or change its slug or description. `position` is NOT accepted — use reorder_modules.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            name: ModuleUpdateInput.shape.name,
            newSlug: SlugSchema.optional(),
            description: ModuleUpdateInput.shape.description,
        },
        async ({ trackSlug, moduleSlug, newSlug, ...rest }) => {
            const body = {
                ...rest,
                ...(newSlug !== undefined && { slug: newSlug }),
            }
            try {
                return ok(
                    await client.request(
                        "PATCH",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "delete_module",
        "Delete a module and close the position gap. Its lessons are detached, not deleted — the underlying articles survive.",
        { trackSlug: SlugSchema, moduleSlug: SlugSchema },
        async ({ trackSlug, moduleSlug }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "DELETE",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "reorder_modules",
        "Set the full module order for a track. The payload must list EVERY current module slug exactly once.",
        {
            trackSlug: SlugSchema,
            moduleSlugs: ModuleReorderInput.shape.moduleSlugs,
        },
        async ({ trackSlug, moduleSlugs }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/reorder`,
                        { moduleSlugs },
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "add_lesson_to_module",
        "Attach a published article to a module as a lesson. Appends unless `position` is given. The same article may appear in more than one module.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            articleSlug: ModuleLessonAddInput.shape.articleSlug,
            position: ModuleLessonAddInput.shape.position,
        },
        async ({ trackSlug, moduleSlug, ...body }) => {
            try {
                return ok(
                    await client.request(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}/lessons`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "remove_lesson_from_module",
        "Detach a lesson from a module. The article itself is not deleted.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            articleSlug: SlugSchema,
        },
        async ({ trackSlug, moduleSlug, articleSlug }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "DELETE",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}/lessons/${enc(articleSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "reorder_module_lessons",
        "Set the full lesson order within a module. The payload must list EVERY current lesson's article slug exactly once.",
        {
            trackSlug: SlugSchema,
            moduleSlug: SlugSchema,
            articleSlugs: ModuleLessonReorderInput.shape.articleSlugs,
        },
        async ({ trackSlug, moduleSlug, articleSlugs }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "POST",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(moduleSlug)}/lessons/reorder`,
                        { articleSlugs },
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "list_checkpoints",
        "List a lesson's checkpoint problems in order.",
        { articleSlug: SlugSchema },
        async ({ articleSlug }) => {
            try {
                return ok(
                    await client.request(
                        "GET",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "add_checkpoint",
        "Attach a problem to a lesson as a checkpoint. A problem checks exactly ONE lesson — attaching a problem that already checks another lesson returns 409.",
        {
            articleSlug: SlugSchema,
            problemSlug: CheckpointAddInput.shape.problemSlug,
            position: CheckpointAddInput.shape.position,
        },
        async ({ articleSlug, ...body }) => {
            try {
                return ok(
                    await client.request(
                        "POST",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints`,
                        body,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "remove_checkpoint",
        "Detach a checkpoint problem from a lesson. The problem itself is not deleted.",
        { articleSlug: SlugSchema, problemSlug: SlugSchema },
        async ({ articleSlug, problemSlug }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "DELETE",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints/${enc(problemSlug)}`,
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "reorder_checkpoints",
        "Set the full checkpoint order for a lesson. The payload must list EVERY current checkpoint's problem slug exactly once.",
        {
            articleSlug: SlugSchema,
            problemSlugs: CheckpointReorderInput.shape.problemSlugs,
        },
        async ({ articleSlug, problemSlugs }) => {
            try {
                return ok(
                    await client.requestRaw(
                        "POST",
                        `/api/admin/lessons/${enc(articleSlug)}/checkpoints/reorder`,
                        { problemSlugs },
                    ),
                )
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )

    server.tool(
        "get_curriculum",
        "Fetch a track's entire curriculum tree — modules, their ordered lessons, and each lesson's checkpoints — in one call. Use this before authoring so you can see current state without N round-trips.",
        { trackSlug: SlugSchema },
        async ({ trackSlug }) => {
            try {
                const modules = await client.request<
                    Array<{ slug: string; name: string; position: number }>
                >("GET", `/api/admin/tracks/${enc(trackSlug)}/modules`)

                const tree = []
                for (const m of modules) {
                    const detail = await client.request<{
                        slug: string
                        name: string
                        position: number
                        lessons: Array<{
                            position: number
                            article: { slug: string; title: string }
                        }>
                    }>(
                        "GET",
                        `/api/admin/tracks/${enc(trackSlug)}/modules/${enc(m.slug)}`,
                    )

                    const lessons = []
                    for (const l of detail.lessons) {
                        const checkpoints = await client.request(
                            "GET",
                            `/api/admin/lessons/${enc(l.article.slug)}/checkpoints`,
                        )
                        lessons.push({ ...l, checkpoints })
                    }
                    tree.push({ ...detail, lessons })
                }
                return ok({ trackSlug, modules: tree })
            } catch (err) {
                if (notFound(err)) return ok({ found: false })
                throw toMcpError(err)
            }
        },
    )
}
