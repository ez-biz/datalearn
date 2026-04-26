import { describe, expect, it, vi } from "vitest"
import { ApiError, DataLearnClient } from "../src/client"

function ok(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    })
}

describe("DataLearnClient", () => {
    it("rejects http:// for non-localhost hosts at construction", () => {
        expect(
            () => new DataLearnClient("k", "http://datalearn.app")
        ).toThrow(/http:\/\/ only allowed for localhost/i)
    })

    it("allows http:// for localhost", () => {
        expect(
            () => new DataLearnClient("k", "http://localhost:3000")
        ).not.toThrow()
    })

    it("allows http:// for 127.0.0.1", () => {
        expect(
            () => new DataLearnClient("k", "http://127.0.0.1:3000")
        ).not.toThrow()
    })

    it("allows https:// for any host", () => {
        expect(
            () => new DataLearnClient("k", "https://datalearn.app")
        ).not.toThrow()
    })

    it("sends Bearer auth header on requests", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: [] }))
        const c = new DataLearnClient("the-key", "http://localhost:3000", fetch)
        await c.request("GET", "/api/admin/topics")
        expect(fetch).toHaveBeenCalledWith(
            "http://localhost:3000/api/admin/topics",
            expect.objectContaining({
                method: "GET",
                headers: expect.objectContaining({
                    Authorization: "Bearer the-key",
                    "Content-Type": "application/json",
                }),
            })
        )
    })

    it("unwraps { data: ... } on 200", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: [{ id: "t1" }] }))
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        const result = await c.request<Array<{ id: string }>>("GET", "/api/admin/topics")
        expect(result).toEqual([{ id: "t1" }])
    })

    it("throws ApiError with body.error on non-2xx", async () => {
        const fetch = vi.fn().mockResolvedValue(
            ok({ error: "Validation failed", details: { x: 1 } }, 400)
        )
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        await expect(
            c.request("POST", "/api/admin/topics", {})
        ).rejects.toMatchObject({
            constructor: ApiError,
            status: 400,
            message: "Validation failed",
        })
    })

    it("includes JSON body on POST", async () => {
        const fetch = vi.fn().mockResolvedValue(ok({ data: { id: "t1" } }, 201))
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        await c.request("POST", "/api/admin/topics", { slug: "x", title: "X" })
        expect(fetch).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ slug: "x", title: "X" }),
            })
        )
    })

    it("falls back to status text when body is not JSON", async () => {
        const fetch = vi.fn().mockResolvedValue(
            new Response("oops", { status: 500 })
        )
        const c = new DataLearnClient("k", "http://localhost:3000", fetch)
        await expect(c.request("GET", "/api/admin/topics")).rejects.toMatchObject({
            status: 500,
        })
    })
})
