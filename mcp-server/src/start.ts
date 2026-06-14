import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "./client.js"
import { registerApiKeyTools } from "./tools/api-keys.js"
import { registerArticleTools } from "./tools/articles.js"
import { registerAssetTools } from "./tools/assets.js"
import { registerContestHiddenTools } from "./tools/contest-hidden.js"
import { registerContestPublishTools } from "./tools/contest-publish.js"
import { registerModeratorTools } from "./tools/moderators.js"
import { registerProblemTools } from "./tools/problems.js"
import { registerSchemaTools } from "./tools/schemas.js"
import { registerTagTools } from "./tools/tags.js"
import { registerTopicTools } from "./tools/topics.js"
import { registerTrackTools } from "./tools/tracks.js"
import { registerUserTools } from "./tools/users.js"

export interface StartConfig {
    apiKey: string
    baseUrl: string
}

export function buildServer(config: StartConfig): {
    server: McpServer
    client: DataLearnClient
} {
    if (!config.apiKey) {
        throw new Error("DATALEARN_API_KEY is required")
    }
    if (!config.baseUrl) {
        throw new Error("DATALEARN_BASE_URL is required")
    }
    const client = new DataLearnClient(config.apiKey, config.baseUrl)
    const server = new McpServer({
        name: "datalearn",
        version: "0.8.0",
    })
    registerTopicTools(server, client)
    registerTagTools(server, client)
    registerSchemaTools(server, client)
    registerProblemTools(server, client)
    registerContestHiddenTools(server, client)
    registerContestPublishTools(server, client)
    registerTrackTools(server, client)
    registerArticleTools(server, client)
    registerApiKeyTools(server, client)
    registerUserTools(server, client)
    registerModeratorTools(server, client)
    registerAssetTools(server, client)
    return { server, client }
}
