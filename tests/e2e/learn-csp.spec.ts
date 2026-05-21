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
})
