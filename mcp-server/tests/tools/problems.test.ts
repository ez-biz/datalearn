import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerProblemTools } from "../../src/tools/problems"

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

const sampleFullProblem = {
    id: "1",
    slug: "simple-select",
    title: "Simple Select",
    difficulty: "EASY",
    status: "PUBLISHED",
    description: "…",
    expectedOutput: "[]",
    solutionSql: "SELECT 1",
    tags: [{ id: "t1", slug: "select", name: "Select" }],
    schema: { id: "s1", name: "Orders" },
}

describe("problems tools", () => {
    it("registers list_problems, get_problem, create_problem", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerProblemTools(server, client)
        const tools = (server as any)._registeredTools as Record<string, unknown>
        expect(Object.keys(tools)).toContain("list_problems")
        expect(Object.keys(tools)).toContain("get_problem")
        expect(Object.keys(tools)).toContain("create_problem")
    })

    it("list_problems projects fields and excludes expectedOutput/solutionSql", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(ok({ data: [sampleFullProblem] }))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.list_problems
        const result = await tool.handler({}, {})
        const text = result.content[0].text
        expect(text).toContain("simple-select")
        expect(text).not.toContain("expectedOutput")
        expect(text).not.toContain("solutionSql")
    })

    it("list_problems filters by difficulty client-side", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({
                data: [
                    { ...sampleFullProblem, difficulty: "EASY" },
                    { ...sampleFullProblem, slug: "med", difficulty: "MEDIUM" },
                    { ...sampleFullProblem, slug: "hard", difficulty: "HARD" },
                ],
            })
        )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.list_problems
        const result = await tool.handler({ difficulty: "MEDIUM" }, {})
        const parsed = JSON.parse(result.content[0].text)
        expect(parsed).toHaveLength(1)
        expect(parsed[0].slug).toBe("med")
    })

    it("get_problem returns the full problem on 200", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: sampleFullProblem }))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.get_problem
        const result = await tool.handler({ slug: "simple-select" }, {})
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/problems/simple-select",
            expect.objectContaining({ method: "GET" })
        )
        expect(result.content[0].text).toContain("expectedOutput")
    })

    it("get_problem returns {found:false} on 404", async () => {
        const fetch = vi.fn().mockResolvedValue(fail("Not found", 404))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.get_problem
        const result = await tool.handler({ slug: "nope" }, {})
        expect(JSON.parse(result.content[0].text)).toEqual({ found: false })
    })

    it("create_problem forces DRAFT in the POST body (even if AI tries to set status)", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValue(ok({ data: sampleFullProblem }, 201))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerProblemTools(server, client)
        const tool = (server as any)._registeredTools.create_problem

        // Even if status="PUBLISHED" is smuggled in, the handler's explicit
        // status: "DRAFT" override (later in spread) wins.
        await tool.handler(
            {
                title: "T",
                slug: "t",
                difficulty: "EASY",
                description: "d",
                schemaInline: {
                    name: "S",
                    sql: "CREATE TABLE t(id INT);",
                },
                expectedOutput: "[]",
                status: "PUBLISHED",
            } as any,
            {}
        )
        const call = fetch.mock.calls[0]
        const body = JSON.parse(call[1].body as string)
        expect(body.status).toBe("DRAFT")
    })
})
