import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerTopicTools } from "../../src/tools/topics"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("topics tools", () => {
    it("registers list_topics and create_topic", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerTopicTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_topics")
        expect(Object.keys(tools)).toContain("create_topic")
    })

    it("list_topics calls GET /api/admin/topics and returns the data", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok({ data: [{ id: "1", slug: "joins", title: "Joins" }] })
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerTopicTools(server, client)
        const tool = (server as any)._registeredTools.list_topics
        const result = await tool.handler({}, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/topics",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("joins")
    })

    it("create_topic POSTs the input and returns the created topic", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(
                ok(
                    { data: { id: "1", slug: "joins", title: "Joins" } },
                    201
                )
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerTopicTools(server, client)
        const tool = (server as any)._registeredTools.create_topic
        const result = await tool.handler(
            { slug: "joins", title: "Joins", description: "desc" },
            {}
        )
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/topics",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    slug: "joins",
                    title: "Joins",
                    description: "desc",
                }),
            })
        )
        expect(result.content[0].text).toContain("joins")
    })
})
