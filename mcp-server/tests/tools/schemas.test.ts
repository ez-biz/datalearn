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

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("schemas tools", () => {
    it("registers list_schemas and create_schema", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerSchemaTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_schemas")
        expect(Object.keys(tools)).toContain("create_schema")
    })

    it("list_schemas calls GET /api/admin/schemas", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ data: [{ id: "1", name: "Orders", sql: "CREATE TABLE orders (id INT);" }] })
        )
        const server = makeServer()
        const client = new DataLearnClient("k", "http://localhost:3000", fetch)
        registerSchemaTools(server, client)
        const tool = (server as any)._registeredTools.list_schemas
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
        const tool = (server as any)._registeredTools.create_schema
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
})
