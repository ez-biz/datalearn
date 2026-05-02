import { describe, expect, it } from "vitest"
import { buildServer } from "../src/start"

describe("buildServer", () => {
    it("throws when DATALEARN_API_KEY is missing", () => {
        expect(() =>
            buildServer({ apiKey: "", baseUrl: "http://localhost:3000" })
        ).toThrow(/DATALEARN_API_KEY/)
    })

    it("throws when DATALEARN_BASE_URL is missing", () => {
        expect(() => buildServer({ apiKey: "k", baseUrl: "" })).toThrow(
            /DATALEARN_BASE_URL/
        )
    })

    it("throws when baseUrl is malformed", () => {
        expect(() =>
            buildServer({ apiKey: "k", baseUrl: "not-a-url" })
        ).toThrow()
    })

    it("returns a server with all 11 tools registered", () => {
        const { server } = buildServer({
            apiKey: "k",
            baseUrl: "http://localhost:3000",
        })
        const tools = (
            server as unknown as { _registeredTools: Record<string, unknown> }
        )._registeredTools
        const names = Object.keys(tools).sort()
        expect(names).toEqual(
            [
                "create_problem",
                "create_schema",
                "create_tag",
                "create_topic",
                "get_problem",
                "list_problems",
                "list_schemas",
                "list_tags",
                "list_topics",
                "update_problem",
                "update_schema",
            ].sort()
        )
    })
})
