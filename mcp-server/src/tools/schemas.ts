import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { SqlSchemaCreateInput } from "../../../lib/admin-validation"
import { DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type SqlSchema = {
    id: string
    name: string
    sql: string
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

export function registerSchemaTools(
    server: McpServer,
    client: DataLearnClient
): void {
    server.tool(
        "list_schemas",
        "List all SQL schemas. Each schema is a SQL string containing table DDL plus optional seed INSERTs. Reuse an existing schema by id (via create_problem's schemaId field) when authoring a problem instead of inlining a duplicate.",
        {},
        async () => {
            try {
                const schemas = await client.request<SqlSchema[]>(
                    "GET",
                    "/api/admin/schemas"
                )
                return ok(schemas)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )

    server.tool(
        "create_schema",
        "Create a new SQL schema. The 'sql' field should contain CREATE TABLE statements and any INSERTs needed for sample data, all in one string.",
        SqlSchemaCreateInput.shape,
        async (input) => {
            try {
                const created = await client.request<SqlSchema>(
                    "POST",
                    "/api/admin/schemas",
                    input
                )
                return ok(created)
            } catch (err) {
                throw toMcpError(err)
            }
        }
    )
}
