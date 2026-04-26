import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ApiError } from "./client.js"

export function toMcpError(err: unknown): McpError {
    if (err instanceof McpError) return err
    if (err instanceof ApiError) {
        if (err.status === 400) {
            return new McpError(ErrorCode.InvalidParams, err.message)
        }
        if (err.status === 401 || err.status === 403) {
            return new McpError(
                ErrorCode.InvalidRequest,
                `auth failed: ${err.message}`
            )
        }
        return new McpError(ErrorCode.InternalError, err.message)
    }
    if (err instanceof Error) {
        return new McpError(ErrorCode.InternalError, err.message)
    }
    return new McpError(ErrorCode.InternalError, String(err))
}
