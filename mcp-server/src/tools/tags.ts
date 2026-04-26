import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { TagCreateInput } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type Tag = { id: string; slug: string; name: string }

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

export function registerTagTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_tags",
        "List all tags. Tags label problems by topic (joins, aggregations, window-functions, etc.).",
        {},
        async () => {
            try {
                const tags = await client.request<Tag[]>(
                    "GET",
                    "/api/admin/tags"
                )
                return ok(tags)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_tag",
        "Create a new tag. Slug must be kebab-case and unique.",
        TagCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<Tag>(
                    "POST",
                    "/api/admin/tags",
                    input
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
