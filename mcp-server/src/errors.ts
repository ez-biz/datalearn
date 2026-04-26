import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ApiError } from "./client.js"

export function toMcpError(err: unknown): McpError {
    // Order matters: most specific subclass first. McpError and ApiError
    // both extend Error; checking Error first would clobber pre-built MCP
    // errors with InternalError. The McpError passthrough also lets per-tool
    // handlers translate errors to specific McpError shapes before this
    // function sees them.
    if (err instanceof McpError) return err
    if (err instanceof ApiError) {
        if (err.status === 400) {
            return new McpError(ErrorCode.InvalidParams, err.message)
        }
        if (err.status === 401 || err.status === 403) {
            // Almost always a config issue; hint the env var so the user
            // knows where to look.
            return new McpError(
                ErrorCode.InvalidRequest,
                `auth failed (check DATALEARN_API_KEY): ${err.message}`
            )
        }
        // Don't leak raw upstream messages on 5xx (or any unmapped status):
        // they may contain paths, stack traces, or other operational details.
        // Log to stderr for ops; surface a generic message to the MCP client.
        console.error(
            `[mcp] upstream API error: HTTP ${err.status}: ${err.message}`,
            err.details ?? ""
        )
        return new McpError(
            ErrorCode.InternalError,
            `upstream error (HTTP ${err.status})`
        )
    }
    if (err instanceof Error) {
        return new McpError(ErrorCode.InternalError, err.message)
    }
    return new McpError(ErrorCode.InternalError, String(err))
}
