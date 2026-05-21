import { expect, test } from "@playwright/test"

test.describe("CSP on /learn/**", () => {
    test("response carries the expected directive set", async ({ page }) => {
        const response = await page.goto("/learn")
        expect(response).not.toBeNull()

        const csp = response!.headers()["content-security-policy"]
        expect(csp).toContain("default-src 'self'")
        expect(csp).toContain("script-src 'self' 'nonce-")
        expect(csp).toContain("frame-ancestors 'none'")
        expect(csp).toContain(
            "img-src 'self' data: https://*.vercel-storage.com"
        )
    })

    test("CSP header is absent on a non-/learn path", async ({ page }) => {
        const response = await page.goto("/practice")
        const csp = response?.headers()["content-security-policy"]

        expect(csp).toBeUndefined()
    })

    test("Next inline scripts use the Learn CSP nonce", async ({ page }) => {
        const cspErrors: string[] = []
        page.on("console", (message) => {
            if (
                message.type() === "error" &&
                message.text().includes("Content Security Policy")
            ) {
                cspErrors.push(message.text())
            }
        })

        const response = await page.goto("/learn/joins/how-a-join-works", {
            waitUntil: "networkidle",
        })
        expect(response).not.toBeNull()

        const csp = response!.headers()["content-security-policy"]
        const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
        expect(nonce).toBeTruthy()

        const inlineScriptNonces = await page
            .locator("script:not([src])")
            .evaluateAll((scripts) => scripts.map((script) => script.nonce))
        expect(inlineScriptNonces.length).toBeGreaterThan(0)
        expect(
            inlineScriptNonces.every((scriptNonce) => scriptNonce === nonce)
        ).toBe(true)
        expect(cspErrors).toEqual([])
    })
})
