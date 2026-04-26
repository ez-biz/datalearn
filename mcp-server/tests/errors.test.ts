import { describe, expect, it } from "vitest"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ApiError } from "../src/client"
import { toMcpError } from "../src/errors"

describe("toMcpError", () => {
    it("400 → InvalidParams with the API error message", () => {
        const err = toMcpError(new ApiError(400, "Validation failed"))
        expect(err).toBeInstanceOf(McpError)
        expect(err.code).toBe(ErrorCode.InvalidParams)
        expect(err.message).toContain("Validation failed")
    })

    it("401 → InvalidRequest with auth-failed prefix", () => {
        const err = toMcpError(new ApiError(401, "Invalid API key."))
        expect(err.code).toBe(ErrorCode.InvalidRequest)
        expect(err.message).toMatch(/auth failed: Invalid API key\./)
    })

    it("403 → InvalidRequest with auth-failed prefix", () => {
        const err = toMcpError(new ApiError(403, "Admin access required."))
        expect(err.code).toBe(ErrorCode.InvalidRequest)
        expect(err.message).toMatch(/auth failed: Admin access required\./)
    })

    it("500 → InternalError", () => {
        const err = toMcpError(new ApiError(500, "boom"))
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("boom")
    })

    it("passes through existing McpError unchanged", () => {
        const original = new McpError(ErrorCode.InvalidParams, "explicit")
        expect(toMcpError(original)).toBe(original)
    })

    it("wraps unknown errors as InternalError", () => {
        const err = toMcpError(new Error("something else"))
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("something else")
    })

    it("wraps non-Error throwables as InternalError", () => {
        const err = toMcpError("string thrown")
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("string thrown")
    })
})
