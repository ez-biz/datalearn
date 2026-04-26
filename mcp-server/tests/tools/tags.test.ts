import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerTagTools } from "../../src/tools/tags"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("tags tools", () => {
    it("registers list_tags and create_tag", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerTagTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_tags")
        expect(Object.keys(tools)).toContain("create_tag")
    })

    it("list_tags calls GET /api/admin/tags", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok({ data: [{ id: "1", slug: "join", name: "Join" }] })
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerTagTools(server, client)
        const tool = (server as any)._registeredTools.list_tags
        const result = await tool.handler({}, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tags",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("join")
    })

    it("create_tag POSTs the input", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok({ data: { id: "1", slug: "join", name: "Join" } }, 201)
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerTagTools(server, client)
        const tool = (server as any)._registeredTools.create_tag
        await tool.handler({ slug: "join", name: "Join" }, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tags",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ slug: "join", name: "Join" }),
            })
        )
    })
})
