import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { DataLearnClient } from "./client.js"
import { registerProblemTools } from "./tools/problems.js"
import { registerSchemaTools } from "./tools/schemas.js"
import { registerTagTools } from "./tools/tags.js"
import { registerTopicTools } from "./tools/topics.js"

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
        version: "0.1.0",
    })
    registerTopicTools(server, client)
    registerTagTools(server, client)
    registerSchemaTools(server, client)
    registerProblemTools(server, client)
    return { server, client }
}
