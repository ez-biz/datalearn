import { afterEach, describe, expect, it, vi } from "vitest"
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js"
import { ApiError } from "../src/client"
import { toMcpError } from "../src/errors"

describe("toMcpError", () => {
    // Silence (and assert on) the stderr logging that fires for
    // unmapped statuses — it's an ops signal, not a test failure.
    const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {})
    afterEach(() => consoleErrorSpy.mockClear())

    it("400 → InvalidParams with the API error message", () => {
        const err = toMcpError(new ApiError(400, "Validation failed"))
        expect(err).toBeInstanceOf(McpError)
        expect(err.code).toBe(ErrorCode.InvalidParams)
        expect(err.message).toContain("Validation failed")
    })

    it("401 → InvalidRequest with auth-failed prefix", () => {
        const err = toMcpError(new ApiError(401, "Invalid API key."))
        expect(err.code).toBe(ErrorCode.InvalidRequest)
        expect(err.message).toMatch(/auth failed \(check DATALEARN_API_KEY\): Invalid API key\./)
    })

    it("403 → InvalidRequest with auth-failed prefix", () => {
        const err = toMcpError(new ApiError(403, "Admin access required."))
        expect(err.code).toBe(ErrorCode.InvalidRequest)
        expect(err.message).toMatch(/auth failed \(check DATALEARN_API_KEY\): Admin access required\./)
    })

    it("500 → InternalError with generic message (does not leak upstream message)", () => {
        const err = toMcpError(new ApiError(500, "boom — db at /var/lib/postgres broke"))
        expect(err.code).toBe(ErrorCode.InternalError)
        // Generic message — upstream details are logged to stderr only.
        expect(err.message).toContain("upstream error (HTTP 500)")
        expect(err.message).not.toContain("boom")
        expect(err.message).not.toContain("postgres")
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

    it("404 falls through to InternalError (handled per-tool, not centrally)", () => {
        const err = toMcpError(new ApiError(404, "Not found"))
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("upstream error (HTTP 404)")
    })

    it("429 falls through to InternalError", () => {
        const err = toMcpError(new ApiError(429, "Too many requests"))
        expect(err.code).toBe(ErrorCode.InternalError)
        expect(err.message).toContain("upstream error (HTTP 429)")
    })
})
