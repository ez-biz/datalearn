import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import {
    SqlSchemaCreateInput,
    SqlSchemaUpdateInput,
} from "../../../lib/admin-validation"
import { ApiError, DataLearnClient } from "../client.js"
import { toMcpError } from "../errors.js"

type SqlSchema = {
    id: string
    name: string
    sql: string
}

const McpSchemaUpdateInputShape = {
    id: z.string().min(1),
    ...SqlSchemaUpdateInput.shape,
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

    server.tool(
        "update_schema",
        "Update an existing SQL schema by id. Only the fields you pass will be changed. Returns the updated schema or {found: false}.",
        McpSchemaUpdateInputShape,
        async ({ id, ...updates }) => {
            try {
                const updated = await client.request<SqlSchema>(
                    "PATCH",
                    `/api/admin/schemas/${encodeURIComponent(id)}`,
                    updates
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
