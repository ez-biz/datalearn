import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TopicCreateInput } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Topic = {
    id: string
    slug: string
    title: string
    description: string | null
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

export function registerTopicTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_topics",
        "List all topics on Data Learn. Topics group articles; problems use tags, not topics.",
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
        "Create a new topic. Slug must be kebab-case and unique.",
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
}
