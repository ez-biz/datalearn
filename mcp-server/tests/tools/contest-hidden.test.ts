import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerContestHiddenTools } from "../../src/tools/contest-hidden"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
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
    return (
        server as unknown as {
            _registeredTools: Record<string, RegisteredTool>
        }
    )._registeredTools
}

describe("contest hidden-data tools", () => {
    it("registers set_problem_hidden_dataset", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerContestHiddenTools(server, client)
        expect(Object.keys(registeredTools(server))).toContain(
            "set_problem_hidden_dataset"
        )
    })

    it("PUTs hidden dataset bodies by problem slug and returns the updated problem metadata", async () => {
        const updated = {
            id: "problem-id",
            slug: "contest-hidden-problem",
            hiddenDataValidatedAt: "2026-05-25T00:00:00.000Z",
            hiddenDataValidationFingerprint: "abc123",
        }
        const fetch = vi.fn().mockResolvedValue(ok({ data: updated }))
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerContestHiddenTools(server, client)
        const tool = registeredTools(server).set_problem_hidden_dataset

        const result = await tool.handler(
            {
                slug: "contest-hidden-problem",
                hiddenSchemas: {
                    DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1);",
                },
                hiddenExpectedOutputs: { DUCKDB: [{ x: 1 }] },
            },
            {}
        )

        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/problems/contest-hidden-problem/hidden-data",
            expect.objectContaining({ method: "PUT" })
        )
        const body = JSON.parse(fetch.mock.calls[0][1].body as string)
        expect(body).toEqual({
            hiddenSchemas: {
                DUCKDB: "CREATE TABLE t (x INT); INSERT INTO t VALUES (1);",
            },
            hiddenExpectedOutputs: { DUCKDB: [{ x: 1 }] },
        })
        expect(JSON.parse(result.content[0].text)).toEqual(updated)
    })
})
