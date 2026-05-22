import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TopicCreateInput, TopicUpdateInput, SlugSchema } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Topic = {
    id: string
    slug: string
    name: string
    description: string | null
    lane: "SQL" | "DATA_ENGINEERING"
    displayOrder: number
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

const McpTopicUpdateInputShape = {
    slug: SlugSchema,
    newSlug: SlugSchema.optional(),
    name: TopicUpdateInput.shape.name,
    description: TopicUpdateInput.shape.description,
    lane: TopicUpdateInput.shape.lane,
    displayOrder: TopicUpdateInput.shape.displayOrder,
}

export function registerTopicTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_topics",
        "List all topics on Data Learn, sorted by lane then displayOrder. Topics group articles; problems use tags, not topics.",
        {},
        async () => {
            try {
                const topics = await client.request<Topic[]>(
                    "GET",
                    "/api/admin/topics"
                )
                return ok(topics)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_topic",
        [
            "Create a new topic. Slug must be kebab-case and unique.",
            "lane: SQL (default) or DATA_ENGINEERING — which curriculum lane the topic belongs to.",
            "displayOrder: integer (default 0) — controls position within the lane on /learn.",
        ].join("\n"),
        TopicCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<Topic>(
                    "POST",
                    "/api/admin/topics",
                    input
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "update_topic",
        [
            "Update an existing topic by slug. PATCH semantics: only the fields you pass are changed.",
            "",
            "Pass `newSlug` to rename the topic's slug (kebab-case, must be unique).",
            "Pass `lane` to move the topic to the other curriculum lane.",
            "Pass `displayOrder` to reposition within its lane on /learn.",
        ].join("\n"),
        McpTopicUpdateInputShape,
        async (input) => {
            const { slug, newSlug, ...rest } = input
            try {
                const body = newSlug ? { ...rest, slug: newSlug } : rest
                const updated = await client.request<Topic>(
                    "PATCH",
                    `/api/admin/topics/${encodeURIComponent(slug)}`,
                    body
                )
                return ok(updated)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
