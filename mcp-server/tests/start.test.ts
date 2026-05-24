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

    it("registers the full tool surface", () => {
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
                // topics
                "list_topics",
                "create_topic",
                "update_topic",
                // tags
                "list_tags",
                "create_tag",
                // schemas
                "list_schemas",
                "create_schema",
                "update_schema",
                // problems
                "list_problems",
                "get_problem",
                "create_problem",
                "update_problem",
                // tracks
                "list_tracks",
                "get_track",
                "create_track",
                "update_track",
                "add_track_item",
                "remove_track_item",
                "reorder_track_items",
                // articles (v0.5.0)
                "list_articles",
                "get_article",
                "create_article",
                "update_article",
                // article review workflow (v0.6.0)
                "submit_article",
                "approve_article",
                "reject_article",
                "archive_article",
                // ops + admin lifecycle (v0.7.0)
                "delete_topic",
                "delete_track",
                "list_api_keys",
                "create_api_key",
                "revoke_api_key",
                "list_users",
                "update_user_role",
                "list_moderators",
                "grant_moderator",
                "update_moderator_permissions",
                "revoke_moderator",
                // assets (v0.8.0)
                "list_assets",
                "delete_asset",
            ].sort()
        )
    })
})
