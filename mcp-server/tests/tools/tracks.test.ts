import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerTrackTools } from "../../src/tools/tracks"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

function makeServer() {
    return new McpServer({ name: "test", version: "0.0.0" })
}

describe("tracks tools", () => {
    it("registers list/get/create/update track tools", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn(),
        )
        registerTrackTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toEqual(
            expect.arrayContaining([
                "list_tracks",
                "get_track",
                "create_track",
                "update_track",
            ]),
        )
    })

    it("list_tracks calls GET /api/admin/tracks and returns data", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({
                data: [
                    {
                        id: "1",
                        slug: "window-functions",
                        name: "Window Functions",
                        status: "PUBLISHED",
                    },
                ],
            }),
        )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch,
        )
        registerTrackTools(server, client)
        const tool = (server as any)._registeredTools.list_tracks
        const result = await tool.handler({}, {})

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tracks",
            expect.objectContaining({ method: "GET" }),
        )
        expect(result.content[0].text).toContain("window-functions")
    })

    it("get_track returns {found:false} for 404", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(ok({ error: "Not found." }, 404))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch,
        )
        registerTrackTools(server, client)
        const tool = (server as any)._registeredTools.get_track
        const result = await tool.handler({ slug: "missing-track" }, {})

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tracks/missing-track",
            expect.objectContaining({ method: "GET" }),
        )
        expect(result.content[0].text).toContain('"found": false')
    })

    it("create_track POSTs the input", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok(
                {
                    data: {
                        id: "1",
                        slug: "faang-sql",
                        name: "FAANG SQL",
                        status: "DRAFT",
                    },
                },
                201,
            ),
        )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch,
        )
        registerTrackTools(server, client)
        const tool = (server as any)._registeredTools.create_track
        await tool.handler(
            {
                name: "FAANG SQL",
                slug: "faang-sql",
                summary: "Interview set",
                description: "Curated SQL practice.",
            },
            {},
        )

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tracks",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({
                    name: "FAANG SQL",
                    slug: "faang-sql",
                    summary: "Interview set",
                    description: "Curated SQL practice.",
                }),
            }),
        )
    })

    it("update_track PATCHes by slug and omits slug from the body", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({
                data: {
                    id: "1",
                    slug: "faang-sql",
                    name: "FAANG SQL",
                    status: "PUBLISHED",
                },
            }),
        )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch,
        )
        registerTrackTools(server, client)
        const tool = (server as any)._registeredTools.update_track
        await tool.handler(
            {
                slug: "faang-sql",
                status: "PUBLISHED",
                estimatedMinutes: 120,
            },
            {},
        )

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/tracks/faang-sql",
            expect.objectContaining({
                method: "PATCH",
                body: JSON.stringify({
                    status: "PUBLISHED",
                    estimatedMinutes: 120,
                }),
            }),
        )
    })
})
