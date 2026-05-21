import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { buildServer } from "./start.js"

// Injected by tsup at bundle time via `define`. Fall back to "dev"
// when running unbundled (e.g. `tsx src/index.ts`) so the binding
// always exists.
declare const __DATALEARN_MCP_BUILD_TIME__: string | undefined
declare const __DATALEARN_MCP_GIT_SHA__: string | undefined
const BUILD_TIME =
    typeof __DATALEARN_MCP_BUILD_TIME__ === "string"
        ? __DATALEARN_MCP_BUILD_TIME__
        : "dev"
const GIT_SHA =
    typeof __DATALEARN_MCP_GIT_SHA__ === "string"
        ? __DATALEARN_MCP_GIT_SHA__
        : "dev"

async function main(): Promise<void> {
    const apiKey = process.env.DATALEARN_API_KEY ?? ""
    const baseUrl = process.env.DATALEARN_BASE_URL ?? ""

    // Log build info first thing, BEFORE any other work. Even if
    // startup fails (bad env, etc.) the host already sees which
    // bundle it loaded — that's the whole point of this line.
    console.error(
        `[datalearn-mcp] bundle ${GIT_SHA}, built ${BUILD_TIME}`
    )

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
