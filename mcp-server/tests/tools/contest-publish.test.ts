import { describe, expect, it, vi } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "../../src/client"
import { registerContestPublishTools } from "../../src/tools/contest-publish"

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

const scheduledRatedContest = {
    id: "cmplpublishcontest000000000001",
    status: "SCHEDULED",
    rated: true,
    problems: [
        {
            position: 1,
            problem: {
                id: "cmplproblem000000000000001",
                slug: "contest-problem-one",
            },
        },
    ],
}

describe("contest publish readiness tool", () => {
    it("registers publish_contest", () => {
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            vi.fn()
        )
        registerContestPublishTools(server, client)
        expect(Object.keys(registeredTools(server))).toContain("publish_contest")
    })

    it("returns ready for unrated contests without reading hidden bodies or statuses", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({
                data: {
                    ...scheduledRatedContest,
                    rated: false,
                },
            })
        )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerContestPublishTools(server, client)

        const result = await registeredTools(server).publish_contest.handler(
            { contestId: scheduledRatedContest.id },
            {}
        )

        expect(fetch).toHaveBeenCalledTimes(1)
        expect(JSON.parse(result.content[0].text)).toEqual({
            ready: true,
            note: "Unrated contest - hidden data not required.",
        })
    })

    it("checks hidden-data status by problem slug for rated contests", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce(ok({ data: scheduledRatedContest }))
            .mockResolvedValueOnce(
                ok({
                    data: {
                        dialects: ["DUCKDB", "POSTGRES"],
                        presentDialects: ["DUCKDB"],
                        validatedAt: null,
                        validationStale: true,
                    },
                })
            )
        const server = makeServer()
        const client = new DataLearnClient(
            "k",
            "http://localhost:3000",
            fetch
        )
        registerContestPublishTools(server, client)

        const result = await registeredTools(server).publish_contest.handler(
            { contestId: scheduledRatedContest.id },
            {}
        )

        expect(fetch).toHaveBeenNthCalledWith(
            2,
            "http://localhost:3000/api/admin/problems/contest-problem-one/hidden-data/status",
            expect.objectContaining({ method: "GET" })
        )
        const parsed = JSON.parse(result.content[0].text)
        expect(parsed.ready).toBe(false)
        expect(parsed.issues).toEqual([
            "Q1 (contest-problem-one): missing hidden data for POSTGRES",
            "Q1 (contest-problem-one): hidden data has never been validated; re-run set_problem_hidden_dataset",
            "Q1 (contest-problem-one): hidden data validation is stale; re-run set_problem_hidden_dataset",
        ])
    })
})
