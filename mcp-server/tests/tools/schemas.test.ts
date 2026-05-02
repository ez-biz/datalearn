import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerSchemaTools } from "../../src/tools/schemas"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function fail(error: string, status: number): Response {
    return new Response(JSON.stringify({ error }), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

type ToolResult = { content: Array<{ text: string }> }
type RegisteredTool = {
    handler: (
        input: Record<string, unknown>,
        extra: Record<string, unknown>
    ) => Promise<ToolResult>
}

function registeredTools(server: McpServer): Record<string, RegisteredTool> {
    return (server as unknown as { _registeredTools: Record<string, RegisteredTool> })
        ._registeredTools
}

describe("schemas tools", () => {
    it("registers list_schemas, create_schema, and update_schema", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerSchemaTools(server, client)
        const tools = registeredTools(server)
        expect(Object.keys(tools)).toContain("list_schemas")
        expect(Object.keys(tools)).toContain("create_schema")
        expect(Object.keys(tools)).toContain("update_schema")
    })

    it("list_schemas calls GET /api/admin/schemas", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ data: [{ id: "1", name: "Orders", sql: "CREATE TABLE orders (id INT);" }] })
        )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = registeredTools(server).list_schemas
        const result = await tool.handler({}, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/schemas",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("Orders")
    })

    it("create_schema POSTs the input", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ data: { id: "1", name: "Orders", sql: "CREATE TABLE orders (id INT);" } }, 201)
        )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = registeredTools(server).create_schema
        await tool.handler(
            {
                name: "Orders",
                sql: "CREATE TABLE orders (id INT); INSERT INTO orders VALUES (1);",
            },
            {}
        )
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/schemas",
            expect.objectContaining({ method: "POST" })
        )
    })

    it("update_schema PATCHes only the passed fields and returns the updated schema", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({
                data: {
                    id: "schema-1",
                    name: "Orders v2",
                    sql: "CREATE TABLE orders (id INT, total DOUBLE);",
                },
            })
        )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = registeredTools(server).update_schema

        const result = await tool.handler(
            {
                id: "schema-1",
                name: "Orders v2",
            },
            {}
        )

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/schemas/schema-1",
            expect.objectContaining({ method: "PATCH" })
        )
        const call = fetch.mock.calls[0]
        expect(JSON.parse(call[1].body as string)).toEqual({
            name: "Orders v2",
        })
        expect(JSON.parse(result.content[0].text)).toMatchObject({
            id: "schema-1",
            name: "Orders v2",
        })
    })

    it("update_schema returns {found:false} on 404", async () => {
        const fetch = vi.fn().mockResolvedValue(fail("Not found", 404))
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = registeredTools(server).update_schema

        const result = await tool.handler({ id: "missing-schema", sql: "SELECT 1;" }, {})

        expect(JSON.parse(result.content[0].text)).toEqual({ found: false })
    })
})
