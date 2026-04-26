import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { buildServer } from "./start.js"

async function main(): Promise<void> {
    const apiKey = process.env.DATALEARN_API_KEY ?? ""
    const baseUrl = process.env.DATALEARN_BASE_URL ?? ""

    let server: McpServer
    try {
        ;({ server } = buildServer({ apiKey, baseUrl }))
    } catch (err) {
        console.error(
            `[datalearn-mcp] startup failed: ${
                err instanceof Error ? err.message : String(err)
            }`
        )
        process.exit(1)
    }

    const transport = new StdioServerTransport()
    await server.connect(transport)
    // Use .origin so any basic-auth credentials accidentally embedded in
    // DATALEARN_BASE_URL (e.g. http://user:pass@host) are stripped from
    // the log — MCP clients persist stderr.
    const safeBase = (() => {
        try {
            return new URL(baseUrl).origin
        } catch {
            return baseUrl
        }
    })()
    console.error(`[datalearn-mcp] connected, base=${safeBase}`)
}

main().catch((err) => {
    console.error("[datalearn-mcp] fatal:", err)
    process.exit(1)
})
