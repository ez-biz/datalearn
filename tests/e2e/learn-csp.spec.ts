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
        // Mermaid v11 needs Function() — keep 'unsafe-eval' until we
        // pre-render mermaid to SVG at publish time (planned v0.6).
        expect(csp).toContain("'unsafe-eval'")
        // Analytics scripts must be reachable from /learn/**.
        expect(csp).toContain("https://www.googletagmanager.com")
        expect(csp).toContain("https://*.vercel-insights.com")
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

        // Keep the run hermetic. playwright.config.ts pins a deliberately
        // invalid NEXT_PUBLIC_GA_MEASUREMENT_ID so <GoogleAnalytics> renders;
        // its inline bootstrap is what this test exists to check, and the
        // outbound fetch of gtag.js contributes nothing to that.
        await page.route("https://www.googletagmanager.com/**", (route) =>
            route.fulfill({ status: 200, contentType: "text/javascript", body: "" })
        )

        const response = await page.goto("/learn/joins/how-a-join-works", {
            waitUntil: "networkidle",
        })
        expect(response).not.toBeNull()

        const csp = response!.headers()["content-security-policy"]
        const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
        expect(nonce).toBeTruthy()

        const inlineScripts = await page
            .locator("script:not([src])")
            .evaluateAll((scripts) =>
                scripts.map((script) => ({
                    nonce: script.nonce,
                    body: script.textContent ?? "",
                }))
            )
        expect(inlineScripts.length).toBeGreaterThan(0)

        // Non-vacuity guard. This assertion is the whole point of the test:
        // the Google Analytics bootstrap is a third-party inline script that
        // does NOT get a nonce for free, and for months it was absent from
        // CI entirely, so "every inline script is nonced" was true over a set
        // that excluded the only interesting member. If GA stops rendering
        // here, fail loudly rather than quietly proving nothing.
        const gaBootstrap = inlineScripts.filter((script) =>
            script.body.includes("dataLayer")
        )
        expect(
            gaBootstrap,
            "expected the GoogleAnalytics inline bootstrap to be present — " +
                "without it this test passes vacuously"
        ).toHaveLength(1)

        const unnonced = inlineScripts.filter(
            (script) => script.nonce !== nonce
        )
        expect(
            unnonced.map((script) => script.body.slice(0, 80)),
            "every inline script on /learn/** must carry the CSP nonce"
        ).toEqual([])
        expect(cspErrors).toEqual([])
    })
})
