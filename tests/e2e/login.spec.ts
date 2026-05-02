import { test, expect } from "@playwright/test"

test.describe("custom sign-in page", () => {
    test("renders provider actions", async ({ page }) => {
        await page.goto("/auth/signin")

        await expect(
            page.getByRole("heading", {
                name: /train like the query is going live/i,
            })
        ).toBeVisible()
        await expect(
            page.getByRole("link", { name: /continue with google/i })
        ).toBeVisible()
        await expect(
            page.getByRole("link", { name: /continue with github/i })
        ).toBeVisible()
    })

    test("provider links preserve safe internal callback", async ({ page }) => {
        await page.goto("/auth/signin?callbackUrl=/profile")

        await expect(
            page.getByRole("link", { name: /continue with google/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/google?callbackUrl=%2Fprofile"
        )
        await expect(
            page.getByRole("link", { name: /continue with github/i })
        ).toHaveAttribute(
            "href",
            "/api/auth/signin/github?callbackUrl=%2Fprofile"
        )
    })

    test("provider links reject external callback", async ({ page }) => {
        const unsafeCallbacks = [
            "https%3A%2F%2Fexample.com%2Fsteal",
            "%2F%2Fevil.example",
            "%2F%5C%5Cevil.example",
            "%2F%0A%2Fevil.example",
            "%2F%5C%ZZ",
        ]

        for (const callbackUrl of unsafeCallbacks) {
            await page.goto(`/auth/signin?callbackUrl=${callbackUrl}`)

            await expect(
                page.getByRole("link", { name: /continue with google/i })
            ).toHaveAttribute("href", "/api/auth/signin/google?callbackUrl=%2F")
            await expect(
                page.getByRole("link", { name: /continue with github/i })
            ).toHaveAttribute("href", "/api/auth/signin/github?callbackUrl=%2F")
        }
    })

    test("renders generic error state", async ({ page }) => {
        await page.goto("/auth/signin?error=AccessDenied")

        await expect(
            page.getByText("Sign-in could not be completed.")
        ).toBeVisible()
    })

    test("mobile layout keeps sign-in actions visible without horizontal scroll", async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 812 })
        await page.goto("/auth/signin?callbackUrl=/me/lists")

        await expect(
            page.getByRole("link", { name: /continue with google/i })
        ).toBeVisible()
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth >
                document.documentElement.clientWidth
        )
        expect(overflow).toBe(false)
    })
})
